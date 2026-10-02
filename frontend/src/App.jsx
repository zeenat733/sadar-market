import { Routes, Route } from 'react-router-dom'
import Admin from './Admin.jsx'
import { useState, useEffect, useRef } from 'react'
import { API_BASE } from './config.js'
import './App.css'

function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.15 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, visible]
}

function ShopPage() {
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState(false)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [justAdded, setJustAdded] = useState(null)
  const [badgeBump, setBadgeBump] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const prevCount = useRef(0)
  const [productsRef, productsVisible] = useReveal()
  const [contactRef, contactVisible] = useReveal()

  function loadProducts() {
    setProductsLoading(true)
    setProductsError(false)
    fetch(`${API_BASE}/products`)
      .then(response => {
        if (!response.ok) throw new Error('Request failed')
        return response.json()
      })
      .then(data => setProducts(data))
      .catch(() => setProductsError(true))
      .finally(() => setProductsLoading(false))
  }

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function cartQuantityFor(productId) {
    return cart.find(item => item.product_id === productId)?.quantity || 0
  }

  function addToCart(product) {
    const inCart = cartQuantityFor(product.id)
    if (inCart >= product.stock) return

    const existingItem = cart.find(item => item.product_id === product.id)
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { product_id: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock }])
    }

    setJustAdded(product.id)
    setTimeout(() => {
      setJustAdded(current => (current === product.id ? null : current))
    }, 900)
  }

  function incrementItem(productId) {
    setCart(cart.map(item =>
      item.product_id === productId && item.quantity < item.stock
        ? { ...item, quantity: item.quantity + 1 }
        : item
    ))
  }

  function decrementItem(productId) {
    setCart(
      cart
        .map(item => item.product_id === productId ? { ...item, quantity: item.quantity - 1 } : item)
        .filter(item => item.quantity > 0)
    )
  }

  function removeItem(productId) {
    setCart(cart.filter(item => item.product_id !== productId))
  }

  function checkout() {
    setCheckingOut(true)
    setCheckoutError('')
    fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_name: 'Guest Customer',
        guest_email: 'guest@example.com',
        items: cart.map(item => ({ product_id: item.product_id, quantity: item.quantity }))
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.checkout_url) {
          window.location.href = data.checkout_url
        } else {
          setCheckoutError(data.error || 'Something went wrong. Please try again.')
          setCheckingOut(false)
        }
      })
      .catch(() => {
        setCheckoutError('Could not reach the server. Please try again.')
        setCheckingOut(false)
      })
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    if (itemCount > prevCount.current) {
      setBadgeBump(true)
      const t = setTimeout(() => setBadgeBump(false), 400)
      prevCount.current = itemCount
      return () => clearTimeout(t)
    }
    prevCount.current = itemCount
  }, [itemCount])

  return (
    <div>
      <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="navbar-inner">
          <div className="nav-brand">
            <img src="/logo.png.jpg" alt="Sadat Market" className="nav-logo" />
            <span>Sadat Market</span>
          </div>
          <div className="nav-links">
            <a href="#products">Shop</a>
            <a href="#contact">Contact</a>
          </div>
          <button className="nav-cart-btn" onClick={() => setCartOpen(true)} aria-label={`View cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}>
            🛒 {itemCount > 0 && <span className={`badge ${badgeBump ? 'pop' : ''}`}>{itemCount}</span>}
          </button>
        </div>
      </nav>

      <section className="hero">
        <img src="/logo.png.jpg" alt="Sadat Market" className="hero-logo" />
        <p className="hero-tagline">Fresh &middot; Halal &middot; Local</p>
        <h1 className="hero-headline">Quality Meats,<br />Sourced With Care</h1>
        <a href="#products" className="btn-shop-now">Shop Now</a>
        <a href="#products" className="scroll-cue" aria-label="Scroll to products">
          <span></span>
        </a>
      </section>

      <div className={`main-wrap reveal ${productsVisible ? 'visible' : ''}`} id="products" ref={productsRef}>
        <h2 className="section-label">Our Products</h2>
        <p className="section-sub">Hand-selected cuts, fresh every day.</p>

        {productsError && (
          <div className="inline-error">
            Couldn't load products right now. <button className="link-btn" onClick={loadProducts}>Try again</button>
          </div>
        )}

        {!productsError && (
          <div className="product-grid">
            {productsLoading && Array.from({ length: 3 }).map((_, i) => (
              <div className="product-card skeleton-card" key={`skeleton-${i}`}>
                <div className="skeleton-block skeleton-image"></div>
                <div className="product-body">
                  <div className="skeleton-block skeleton-line" style={{ width: '70%' }}></div>
                  <div className="skeleton-block skeleton-line" style={{ width: '40%' }}></div>
                  <div className="skeleton-block skeleton-line skeleton-btn"></div>
                </div>
              </div>
            ))}
            {!productsLoading && products.length === 0 && (
              <p className="section-sub">No products available right now — check back soon.</p>
            )}
            {!productsLoading && products.map((product, i) => {
              const inCart = cartQuantityFor(product.id)
              const outOfStock = product.stock <= 0
              const maxedOut = inCart >= product.stock
              return (
                <div className="product-card" style={{ animationDelay: `${i * 0.08}s` }} key={product.id}>
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="product-image" />
                  ) : (
                    <div className="product-image-placeholder">🥩</div>
                  )}
                  {outOfStock && <span className="out-of-stock-badge">Out of Stock</span>}
                  <div className="product-body">
                    <h3>{product.name}</h3>
                    <div className="price-row">
                      <span className="price">${product.price.toFixed(2)}</span>
                      <span className="stock">{outOfStock ? 'Out of stock' : `${product.stock} in stock`}</span>
                    </div>
                    <button
                      className={`btn-add ${justAdded === product.id ? 'added' : ''}`}
                      onClick={() => addToCart(product)}
                      disabled={outOfStock || maxedOut}
                    >
                      {justAdded === product.id ? 'Added ✓' : outOfStock ? 'Out of Stock' : maxedOut ? 'All in Cart' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <section className={`contact-section reveal ${contactVisible ? 'visible' : ''}`} id="contact" ref={contactRef}>
        <div className="contact-inner">
          <div className="contact-block">
            <h2 className="section-label light">Visit Us</h2>
            <p className="contact-line">📍 4740 Martinsburg Pike, Clear Brook, VA 22624</p>
            <p className="contact-line">📞 <a href="tel:5403277257">(540) 327-7257</a></p>
            <p className="contact-line">✉️ <a href="mailto:sadathalalmarket@gmail.com">sadathalalmarket@gmail.com</a></p>
            <p className="contact-line">💬 Sadat Market</p>
          </div>
          <div className="contact-map">
            <iframe
              title="location"
              width="100%"
              height="240"
              style={{ border: 0, borderRadius: '10px' }}
              loading="lazy"
              src="https://www.google.com/maps?q=4740+Martinsburg+Pike,+Clear+Brook,+VA+22624&output=embed">
            </iframe>
          </div>
        </div>
      </section>

      <footer className="footer">
        SADAT HALAL MARKET
        <span>Serving the community with quality and trust.</span>
      </footer>

      {itemCount > 0 && !cartOpen && (
        <button className="cart-fab" onClick={() => setCartOpen(true)}>
          View Cart <span className="badge">{itemCount}</span>
        </button>
      )}

      {cartOpen && <div className="overlay" onClick={() => setCartOpen(false)}></div>}

      <div className={`cart-drawer ${cartOpen ? '' : 'closed'}`}>
        <button className="cart-close" onClick={() => setCartOpen(false)} aria-label="Close cart">&times;</button>
        <h2>Your Cart</h2>
        {cart.length === 0 ? (
          <div className="cart-empty-state">
            <span className="cart-empty-icon">🛒</span>
            <p className="cart-empty">Your cart is empty</p>
            <button className="link-btn" onClick={() => setCartOpen(false)}>Continue Shopping</button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map(item => (
                <div className="cart-item" key={item.product_id}>
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  <div className="cart-item-controls">
                    <button
                      className="qty-btn"
                      onClick={() => decrementItem(item.product_id)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >&minus;</button>
                    <span className="qty-value">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => incrementItem(item.product_id)}
                      disabled={item.quantity >= item.stock}
                      aria-label={`Increase quantity of ${item.name}`}
                    >+</button>
                    <button
                      className="remove-btn"
                      onClick={() => removeItem(item.product_id)}
                      aria-label={`Remove ${item.name} from cart`}
                    >Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            {checkoutError && <p className="inline-error">{checkoutError}</p>}
            <button className="btn-checkout" onClick={checkout} disabled={checkingOut}>
              {checkingOut ? 'Processing…' : 'Checkout'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ShopPage />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  )
}

export default App