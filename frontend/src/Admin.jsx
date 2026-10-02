import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE } from './config.js'
import './Admin.css'

function Admin() {
  const [adminSecret, setAdminSecret] = useState(sessionStorage.getItem('adminSecret') || '')
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [view, setView] = useState('products')
  const [hideCompleted, setHideCompleted] = useState(true)

  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ name: '', price: '', stock: '', image_url: '' })
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(''), 2500)
  }

  function loadProducts() {
    setProductsLoading(true)
    fetch(`${API_BASE}/products`)
      .then(response => {
        if (!response.ok) throw new Error('failed')
        return response.json()
      })
      .then(data => setProducts(data))
      .catch(() => setLoadError('Could not load products.'))
      .finally(() => setProductsLoading(false))
  }

  function loadOrders() {
    setOrdersLoading(true)
    fetch(`${API_BASE}/orders`, {
      headers: { 'X-Admin-Secret': adminSecret }
    })
      .then(response => {
        if (!response.ok) throw new Error('failed')
        return response.json()
      })
      .then(data => setOrders(data))
      .catch(() => setLoadError('Could not load orders.'))
      .finally(() => setOrdersLoading(false))
  }

  useEffect(() => {
    if (adminSecret) {
      loadProducts()
      loadOrders()
    }
  }, [adminSecret])

  function markOrderStatus(orderId, status) {
    fetch(`${API_BASE}/orders/${orderId}/status?status=${status}`, {
      method: 'PATCH',
      headers: { 'X-Admin-Secret': adminSecret }
    })
      .then(() => {
        loadOrders()
        showToast('Order updated')
      })
      .catch(() => showToast('Could not update order — try again'))
  }

  function handleLogin(e) {
    e.preventDefault()
    setLoggingIn(true)
    setAuthError('')
    fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': passwordInput
      },
      body: JSON.stringify({ name: '__auth_check__', price: 0, stock: 0 })
    })
      .then(response => {
        if (response.status === 403) {
          setAuthError('Incorrect password')
          setLoggingIn(false)
        } else {
          sessionStorage.setItem('adminSecret', passwordInput)
          setAdminSecret(passwordInput)
          setAuthError('')
          response.json().then(data => {
            fetch(`${API_BASE}/products/${data.id}`, {
              method: 'DELETE',
              headers: { 'X-Admin-Secret': passwordInput }
            })
          })
        }
      })
      .catch(() => {
        setAuthError('Could not reach the server. Please try again.')
        setLoggingIn(false)
      })
  }

  function handleLogout() {
    sessionStorage.removeItem('adminSecret')
    setAdminSecret('')
    setPasswordInput('')
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    setFormError('')
    const formData = new FormData()
    formData.append('file', file)

    fetch(`${API_BASE}/upload-image`, {
      method: 'POST',
      headers: { 'X-Admin-Secret': adminSecret },
      body: formData
    })
      .then(response => {
        if (!response.ok) throw new Error('failed')
        return response.json()
      })
      .then(data => {
        setForm(prev => ({ ...prev, image_url: data.image_url }))
        setUploading(false)
      })
      .catch(() => {
        setFormError('Photo upload failed — please try again.')
        setUploading(false)
      })
  }

  function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = {
      name: form.name,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
      image_url: form.image_url || null
    }
    const headers = { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret }

    const request = editingId
      ? fetch(`${API_BASE}/products/${editingId}`, { method: 'PUT', headers, body: JSON.stringify(payload) })
      : fetch(`${API_BASE}/products`, { method: 'POST', headers, body: JSON.stringify(payload) })

    request
      .then(response => {
        if (!response.ok) throw new Error('failed')
        setForm({ name: '', price: '', stock: '', image_url: '' })
        setEditingId(null)
        loadProducts()
        showToast(editingId ? 'Product updated' : 'Product added')
      })
      .catch(() => setFormError('Could not save product — please try again.'))
      .finally(() => setSaving(false))
  }

  function handleEdit(product) {
    setForm({ name: product.name, price: product.price, stock: product.stock, image_url: product.image_url || '' })
    setEditingId(product.id)
    setFormError('')
  }

  function handleCancelEdit() {
    setForm({ name: '', price: '', stock: '', image_url: '' })
    setEditingId(null)
    setFormError('')
  }

  function handleDelete(id) {
    if (!confirm('Delete this product?')) return
    fetch(`${API_BASE}/products/${id}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Secret': adminSecret }
    })
      .then(() => {
        loadProducts()
        showToast('Product deleted')
      })
      .catch(() => showToast('Could not delete product — try again'))
  }

  if (!adminSecret) {
    return (
      <div className="admin-login-wrap">
        <form className="admin-login-form" onSubmit={handleLogin}>
          <div className="admin-login-brand">
            <img src="/logo.png.jpg" alt="Sadat Market" />
            <span>Sadat Market</span>
          </div>
          <h2>Admin Login</h2>
          <input
            type="password"
            placeholder="Enter admin password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            required
            autoFocus
          />
          {authError && <p className="login-error">{authError}</p>}
          <button type="submit" className="btn-save btn-full" disabled={loggingIn}>
            {loggingIn ? 'Checking…' : 'Login'}
          </button>
          <Link to="/" className="back-to-shop">← Back to Shop</Link>
        </form>
      </div>
    )
  }

  const visibleOrders = orders.filter(o => !hideCompleted || o.status !== 'completed')
  const pendingCount = orders.filter(o => o.status === 'paid').length

  return (
    <div className="admin-wrap">
      {toast && <div className="admin-toast">{toast}</div>}

      <div className="admin-header">
        <div>
          <Link to="/" className="back-to-shop">← Back to Shop</Link>
          <h1 className="admin-title">Admin Dashboard</h1>
        </div>
        <button className="btn-logout" onClick={handleLogout}>Log Out</button>
      </div>

      {loadError && (
        <div className="inline-error">
          {loadError} <button className="link-btn" onClick={() => { setLoadError(''); loadProducts(); loadOrders(); }}>Try again</button>
        </div>
      )}

      <div className="admin-tabs">
        <button className={view === 'products' ? 'tab-active' : ''} onClick={() => setView('products')}>Products</button>
        <button className={view === 'orders' ? 'tab-active' : ''} onClick={() => setView('orders')}>
          Orders
          {pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
        </button>
      </div>

      {view === 'products' && (
        <>
          <form className="admin-form" onSubmit={handleSubmit}>
            <h2>{editingId ? 'Edit Product' : 'Add New Product'}</h2>
            <div className="form-row">
              <label>
                Product Name
                <input type="text" name="name" value={form.name} onChange={handleChange} required />
              </label>
              <label>
                Price ($)
                <input type="number" step="0.01" min="0" name="price" value={form.price} onChange={handleChange} required />
              </label>
              <label>
                Stock
                <input type="number" min="0" name="stock" value={form.stock} onChange={handleChange} required />
              </label>
            </div>

            <div className="form-row" style={{ marginTop: '1rem' }}>
              <label className="file-label">
                Product Photo
                <span className="file-input-btn">
                  {form.image_url ? 'Change Photo' : 'Choose Photo'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                </span>
              </label>
            </div>

            {uploading && (
              <p className="upload-status"><span className="spinner"></span> Uploading photo...</p>
            )}
            {form.image_url && !uploading && (
              <img src={form.image_url} alt="Preview" className="image-preview" />
            )}

            {formError && <p className="inline-error">{formError}</p>}

            <div className="form-actions">
              <button type="submit" className="btn-save" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Product'}
              </button>
              {editingId && (
                <button type="button" className="btn-cancel" onClick={handleCancelEdit}>Cancel</button>
              )}
            </div>
          </form>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {productsLoading && Array.from({ length: 3 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td><div className="skeleton-block" style={{ width: 44, height: 44, borderRadius: 5 }}></div></td>
                    <td><div className="skeleton-block" style={{ width: '80%', height: '0.9rem' }}></div></td>
                    <td><div className="skeleton-block" style={{ width: 40, height: '0.9rem' }}></div></td>
                    <td><div className="skeleton-block" style={{ width: 30, height: '0.9rem' }}></div></td>
                    <td></td>
                  </tr>
                ))}
                {!productsLoading && products.length === 0 && (
                  <tr><td colSpan={5} className="empty-row">No products yet — add your first one above.</td></tr>
                )}
                {!productsLoading && products.map(product => (
                  <tr key={product.id}>
                    <td>
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="table-thumb" />
                      ) : (
                        <span className="no-photo">—</span>
                      )}
                    </td>
                    <td>{product.name}</td>
                    <td>${product.price.toFixed(2)}</td>
                    <td>
                      {product.stock <= 0
                        ? <span className="stock-pill stock-out">Out</span>
                        : product.stock <= 3
                          ? <span className="stock-pill stock-low">{product.stock} left</span>
                          : product.stock}
                    </td>
                    <td className="admin-actions">
                      <button className="btn-edit" onClick={() => handleEdit(product)}>Edit</button>
                      <button className="btn-delete" onClick={() => handleDelete(product.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'orders' && (
        <div className="orders-list">
          <label className="hide-completed-toggle">
            <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
            Hide completed orders
          </label>

          {ordersLoading && (
            <div className="order-card skeleton-card">
              <div className="skeleton-block" style={{ width: '40%', height: '1.1rem', marginBottom: '0.8rem' }}></div>
              <div className="skeleton-block" style={{ width: '60%', height: '0.85rem', marginBottom: '0.5rem' }}></div>
              <div className="skeleton-block" style={{ width: '30%', height: '0.85rem' }}></div>
            </div>
          )}

          {!ordersLoading && visibleOrders.length === 0 ? (
            <p className="cart-empty">No orders to show</p>
          ) : (
            visibleOrders.map(order => (
              <div className="order-card" key={order.id}>
                <div className="order-header">
                  <span className="order-id">Order #{order.id}</span>
                  <span className={`order-status status-${order.status}`}>{order.status.replace(/_/g, ' ')}</span>
                </div>
                <p className="order-customer">{order.guest_name} &middot; {order.guest_email}</p>
                <p className="order-date">{new Date(order.created_at).toLocaleString()}</p>
                <ul className="order-items">
                  {order.items.map((item, i) => (
                    <li key={i}>{item.product_name} &times; {item.quantity} &mdash; ${(item.price_at_purchase * item.quantity).toFixed(2)}</li>
                  ))}
                </ul>
                <p className="order-total">Total: ${order.total_amount.toFixed(2)}</p>

                <div className="order-actions">
                  {order.status === 'paid' && (
                    <button className="btn-mark-ready" onClick={() => markOrderStatus(order.id, 'ready_for_pickup')}>
                      Mark Ready for Pickup
                    </button>
                  )}
                  {order.status === 'ready_for_pickup' && (
                    <button className="btn-mark-done" onClick={() => markOrderStatus(order.id, 'completed')}>
                      Mark Picked Up
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default Admin