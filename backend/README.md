# The Chinese House - Backend API

Express.js + PostgreSQL backend for the restaurant management system.

## Quick Start

```bash
cd backend
npm install

# 1. Ensure you have a PostgreSQL database running
# Either locally or via a service like Neon DB

# 2. Configure Environment Variables
# Copy the template to your local environment file
cp .env.example .env
# Edit .env with your DATABASE_URL, CLOUDINARY credentials, and JWT_SECRET

# 3. Initialize the database schema
npm run db:init

# 4. Seed the initial admin user
npm run db:seed-admin

# 5. Start the server in development mode
npm run dev
```

## Architecture Notes

- **Multi-Role Authentication:** Uses JWTs to authenticate endpoints for Admins, Kitchen Staff, and Counter Staff.
- **Tenant Enforcement:** Features a robust single-tenant middleware (`tenantEnforcer.js`) that automatically binds queries to the primary restaurant entity, making database operations safe and streamlined.
- **Image Handling:** Integrates `multer` and `cloudinary` for seamless menu item image uploads and gallery management.

## Deployment

For production, ensure the following environment variables are strictly defined in your hosting provider (e.g., Render or Heroku):

- `NODE_ENV=production`
- `DATABASE_URL`
- `CORS_ORIGIN` (Your frontend URL)
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Start the production server via:
```bash
npm start
```
