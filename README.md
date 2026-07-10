🍜 The Chinese House - Restaurant Management & Ordering System
========================================================

A complete, end-to-end **Restaurant Ordering & Management System** built for **The Chinese House**. Designed to simplify table management, streamline kitchen operations, and give the owner full control through a modern, responsive admin dashboard. 

This system empowers customers to place orders directly from their tables via QR codes, provides counter staff with a seamless POS interface, and offers real-time order tracking through a Kitchen Display System (KDS), a customer-facing Token Display, and an intelligent **AI Chatbot**.

---

## ✨ Project Highlights

*   **PWA Ready:** Installable directly to Android tablets as a standalone native app.
*   **Table & QR Ordering:** Customers can scan QR codes to start a session and order directly to their table.
*   **Kitchen Display System (KDS):** Real-time tablet view for chefs to manage incoming tickets with one-tap status updates.
*   **Dynamic CMS:** Admin can update the landing page hero, gallery, menu items, and promotions on the fly.
*   **Smart AI Chatbot:** An integrated Groq-powered AI that acts as a digital waiter, capable of upselling, checking live stock, and distributing public coupons.
*   **Multi-Role Authentication:** Secure login for Admins, Waitstaff, and Kitchen Staff.
*   **Gift Vouchers & Coupons:** Built-in discount engine with AI-promoted public coupons and private VIP vouchers.
*   **Comprehensive Analytics:** Real-time dashboard with customizable date-range sales reporting, menu analytics, and customer loyalty tracking.
*   **SMS Notifications:** Automated Twilio integration to text customers when their order is confirmed or ready.

---

## 🎯 Purpose of the Project

This project was developed to digitize and optimize **The Chinese House** restaurant operations where:

*   Wait times need to be reduced via direct-to-kitchen digital ordering.
*   Counter staff need a rapid POS system for walk-in customers.
*   The kitchen requires an organized, paperless ticket display.
*   Management needs strict control over menu pricing, availability, and daily revenue tracking.
*   Customer support can be automated using intelligent AI to handle menu queries and promotions.

---

## 👨‍🍳 Customer Features

* ✅ Browse categorized menu items with beautiful imagery.
* ✅ Chat with a 24/7 **AI Assistant** to get dish recommendations, check stock, or find discounts.
* ✅ Order directly from the table (QR Code) or at the counter.
* ✅ Receive an instant **token number** via SMS for counter pickups.
* ✅ Track order status on the Token Display screen.
* ✅ View total table bills directly on their mobile device and pay online.
* ✅ Submit star ratings and text reviews for specific dishes.

---

## 📺 Kitchen & Display Screens

**Kitchen Display System (KDS)**
* ✅ Auto-refreshing grid of incoming orders via Server-Sent Events (SSE).
* ✅ One-tap status updates (New -> Preparing -> Ready).
* ✅ Clearly labeled table numbers vs counter orders.

**Token Display Screen**
* ✅ Live token list for today’s counter orders.
* ✅ Visual and audio alerts when an order is "Ready".

---

## 🔐 Admin Dashboard Features

The admin/owner can completely manage the restaurant from a secure dashboard:

* ✅ **Menu Manager:** Add, edit, and toggle out-of-stock items; upload images via Cloudinary.
* ✅ **Landing Page CMS:** Update the hero text, testimonials, gallery images, and promotions.
* ✅ **Staff Management:** Create accounts for cashiers and chefs, and track Waiter sales performance.
* ✅ **Table Management:** Generate QR codes, view active table sessions, and print bills.
* ✅ **Review Moderation:** View customer feedback and delete inappropriate reviews.
* ✅ **Coupons:** Generate promotional codes, set usage limits, and toggle "AI Promoted" distribution.

---

## 📊 Sales & Analytics Reporting

The admin dashboard provides detailed, filterable sales reports including:

* ✅ **Live Revenue Tracking:** Real-time updates on today's performance.
* ✅ **Custom Date Filtering:** Daily, Weekly, Monthly, and Yearly sales breakdowns.
* ✅ **Menu Analytics:** Discover most profitable items, least ordered dishes, and category trends.
* ✅ **Customer Analytics:** Track repeat vs one-time customers, top spenders, and unique identities grouped by phone number.

---

## 🛠️ Technology Stack

### Frontend
*   **Framework:** React 18 + Vite + TypeScript
*   **Styling:** Tailwind CSS + shadcn/ui + Framer Motion (for fluid animations)
*   **Icons:** Lucide React
*   **PWA:** `vite-plugin-pwa` for native tablet installation

### Backend
*   **Framework:** Node.js + Express.js
*   **Database:** PostgreSQL (Neon DB / Supabase compatible)
*   **Caching:** Redis (High-speed cache for analytics and real-time data)
*   **Storage:** Cloudinary (for menu and gallery images)
*   **Authentication:** JWT (JSON Web Tokens) + bcrypt
*   **External APIs:** Groq API (AI Chatbot), Twilio API (SMS)

---

## 🚀 Deployment Guide

**1. Environment Variables**
Configure the provided `.env.example` templates in both `frontend/` and `backend/` directories.
*   `DATABASE_URL`: PostgreSQL connection string.
*   `REDIS_URL`: Redis connection string.
*   `JWT_SECRET`: Secret key for authentication.
*   `GROQ_API_KEY`: API key for the AI Chatbot.
*   `CLOUDINARY_URL`: API URL for image hosting.

**2. Backend (Render / Heroku / VPS)**
- Set the root directory to `backend/`
- Build Command: `npm install`
- Start Command: `npm start` (or `node src/server.js`)
- Ensure your Database and Redis servers are running.

**3. Frontend (Vercel / Netlify)**
- Set the root directory to `frontend/`
- Build Command: `npm run build`
- Output Directory: `dist`
- Set `VITE_API_URL` to point to the live backend server (e.g., `https://api.yourdomain.com/api`).

---

## 📚 Complete Documentation

Extensive documentation is available for developers and users:
- **Developer Documentation:** A complete architecture overview, folder structure breakdown, database schema guide, and API list.
- **User Manual:** A non-technical guide for restaurant staff on how to use the KDS, manage the menu, and handle live orders.

---

## 👨‍💻 Developed By

**Harshvardhan**
Software Developer 🚀

Built specifically for **The Chinese House**.

---

## 🎉 Conclusion

This system completely modernizes the traditional restaurant workflow. From the moment a customer asks the AI Chatbot for a recommendation, to scanning a QR code, to the moment the chef marks the ticket as ready, every step is tracked, optimized, and beautifully presented.
