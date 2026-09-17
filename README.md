# Tiffin_Subscription
# 🍱 TiffinsDirect - Home-Style Tiffin & Subscription Management

A full-stack solution for tiffin service owners to manage customer monthly plans, handle dynamic pause/resume days for travel/festivals, and automatically calculate exact pro-rated bills at month-end.

## 🚀 Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** SQLite (Relational Schema with Users, Subscriptions, and Pause Logs)
- **Frontend:** HTML5, Tailwind CSS, Vanilla JavaScript



## 🔌 REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/register` | Register new customer or tiffin owner |
| `POST` | `/api/login` | Authenticate user and return JWT token |
| `POST` | `/api/forgot-password` | Reset user password via phone verification |
| `GET` | `/api/customers` | Search customers by phone/name, filter by status, pagination & sorting |
| `POST` | `/api/subscription/toggle` | Pause or resume a customer's subscription and log pause days |
