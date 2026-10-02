from pydantic import BaseModel
from typing import List, Optional

class ProductCreate(BaseModel):
    name: str
    price: float
    stock: int
    image_url: str | None = None


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int

class OrderCreate(BaseModel):
    guest_name: Optional[str] = None
    guest_email: Optional[str] = None
    items: List[OrderItemCreate]