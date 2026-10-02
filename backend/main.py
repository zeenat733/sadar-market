from fastapi import FastAPI, Depends, UploadFile, File, Header, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from schemas import ProductCreate, OrderCreate
from fastapi.middleware.cors import CORSMiddleware
import stripe
import os
from dotenv import load_dotenv
import boto3
from fastapi import Request
load_dotenv()

app = FastAPI()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

s3_client = boto3.client(
    "s3",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    region_name=os.getenv("AWS_REGION"),
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_admin(x_admin_secret: str = Header(...)):
    if x_admin_secret != os.getenv("ADMIN_SECRET"):
        raise HTTPException(status_code=403, detail="Invalid admin credentials")

@app.get("/")
def read_root():
    return {"message": "Sadat Halal Shop backend is alive!"}

@app.get("/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()
    return products

@app.post("/products", dependencies=[Depends(verify_admin)])
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    new_product = models.Product(name=product.name, price=product.price, stock=product.stock, image_url=product.image_url)
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

@app.put("/products/{product_id}", dependencies=[Depends(verify_admin)])
def update_product(product_id: int, product: ProductCreate, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if db_product is None:
        return {"error": "Product not found"}
    db_product.name = product.name
    db_product.price = product.price
    db_product.stock = product.stock
    db_product.image_url = product.image_url
    db.commit()
    db.refresh(db_product)
    return db_product

@app.delete("/products/{product_id}", dependencies=[Depends(verify_admin)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if db_product is None:
        return {"error": "Product not found"}
    db.delete(db_product)
    db.commit()
    return {"message": f"Product {product_id} deleted"}

@app.post("/upload-image", dependencies=[Depends(verify_admin)])
def upload_image(file: UploadFile = File(...)):
    bucket = os.getenv("AWS_S3_BUCKET")
    file_key = f"products/{file.filename}"

    s3_client.upload_fileobj(file.file, bucket, file_key, ExtraArgs={"ContentType": file.content_type})

    image_url = f"https://{bucket}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{file_key}"
    return {"image_url": image_url}

@app.get("/orders", dependencies=[Depends(verify_admin)])
def get_orders(db: Session = Depends(get_db)):
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    result = []
    for order in orders:
        items = db.query(models.OrderItem).filter(models.OrderItem.order_id == order.id).all()
        item_list = []
        for item in items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
            item_list.append({
                "product_name": product.name if product else "Unknown product",
                "quantity": item.quantity,
                "price_at_purchase": item.price_at_purchase
            })
        result.append({
            "id": order.id,
            "guest_name": order.guest_name,
            "guest_email": order.guest_email,
            "total_amount": order.total_amount,
            "status": order.status,
            "created_at": order.created_at,
            "items": item_list
        })
    return result
@app.patch("/orders/{order_id}/status", dependencies=[Depends(verify_admin)])
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if order is None:
        return {"error": "Order not found"}
    order.status = status
    db.commit()
    return {"order_id": order.id, "status": order.status}
@app.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        order_id = session["metadata"]["order_id"]

        db = SessionLocal()
        order = db.query(models.Order).filter(models.Order.id == int(order_id)).first()
        if order:
            order.status = "paid"
            db.commit()
        db.close()

    return {"status": "success"}
@app.post("/checkout")
def checkout(order: OrderCreate, db: Session = Depends(get_db)):
    total = 0
    order_items_to_create = []
    line_items = []

    for item in order.items:
        product = db.query(models.Product).filter(models.Product.id == item.product_id).first()
        if product is None:
            return {"error": f"Product {item.product_id} not found"}
        if product.stock < item.quantity:
            return {"error": f"Not enough stock for {product.name}"}

        item_total = product.price * item.quantity
        total += item_total
        order_items_to_create.append((product, item.quantity, product.price))

        line_items.append({
            "price_data": {
                "currency": "usd",
                "product_data": {"name": product.name},
                "unit_amount": int(product.price * 100),
            },
            "quantity": item.quantity,
        })

    new_order = models.Order(
        guest_name=order.guest_name,
        guest_email=order.guest_email,
        total_amount=total,
        status="pending"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    for product, quantity, price in order_items_to_create:
        order_item = models.OrderItem(
            order_id=new_order.id,
            product_id=product.id,
            quantity=quantity,
            price_at_purchase=price
        )
        db.add(order_item)
        product.stock -= quantity

    db.commit()

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=line_items,
        mode="payment",
        success_url=f"http://localhost:5173/success?order_id={new_order.id}",
        cancel_url="http://localhost:5173/cancel",
        metadata={"order_id": str(new_order.id)},
    )

    return {"order_id": new_order.id, "total": total, "checkout_url": session.url}