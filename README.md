# Sadat Market

Full-stack e-commerce web app for a halal grocery market. Includes a customer-facing storefront and a separate admin dashboard.

## Features

### Customer Side
- Browse products and add to cart
- Checkout with Stripe payments

### Admin Dashboard
- Add and delete products with photo uploads
- Track and manage orders (pending → paid → ready → completed)
- Hide completed orders to keep dashboard clean

## Tech Stack

React · FastAPI · PostgreSQL · AWS RDS · AWS S3 · Stripe

## Structure

- `frontend/` — React app (Vite)
- `backend/` — FastAPI REST API with PostgreSQL database
