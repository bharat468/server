# 🏢 RentMate Backend — Multi-Tenant SaaS Engine

> **Enterprise-Grade Rental Property Management Platform Backend**  
> Built with **Modern JavaScript (Node.js ES Modules)**, Express 5, Prisma ORM, and PostgreSQL.  
> Architecture: **Layered Clean Architecture (Controller — Service — Repository)** with strict Multi-Tenant Data Isolation and Dynamic Role-Based Access Control (RBAC).

---

## 📑 Table of Contents
1. [Core Features & Architecture](#-core-features--architecture)
2. [Technology Stack](#-technology-stack)
3. [Multi-Tenant Data & Security Model](#-multi-tenant-data--security-model)
4. [Backend Directory Structure](#-backend-directory-structure)
5. [Complete API Endpoints Directory](#-complete-api-endpoints-directory)
6. [Prisma Database Schema Overview](#-prisma-database-schema-overview)
7. [Environment Variables & Setup Guide](#-environment-variables--setup-guide)
8. [Author & Maintenance](#-author--maintenance)

---

## 🎯 Core Features & Architecture

RentMate backend is engineered following the **Controller-Service-Repository** pattern:
- **Controllers**: Handle HTTP request validation, status codes, and JSON responses.
- **Services**: Contain business logic, financial rules, permission checks, and quota validations.
- **Repositories**: Direct interaction with Prisma ORM and database persistence.
- **Guards & Middlewares**: Token authentication, dynamic RBAC permission evaluation, rate limiting, and centralized error handling.

### Key Functional Highlights:
1. **Public SaaS Plan Directory**: Unauthenticated public endpoints (`GET /api/v1/plans`) allow the marketing website and potential customers to browse active subscription plans.
2. **SuperAdmin Master Control Engine**: Endpoints for platform-wide metrics (MRR, active organizations, total units), organization provisioning, plan creation, and system telemetry.
3. **Multi-Tenant Landlord Workspaces**: Every property, tenant, unit, and payment record is partitioned by `organizationId`.
4. **Passwordless Zero-Trust Auth**: 6-digit cryptographic Mobile OTP generation with fast development logging.
5. **Audit Date-Time Tracking**: Every entity automatically retains standard `createdAt` and `updatedAt` timestamps.

---

## ⚙️ Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Runtime** | **Node.js (v20+)** | Modern asynchronous execution environment |
| **Module System** | **ES Modules (`import / export`)** | Clean modern JavaScript without transpilers |
| **Framework** | **Express 5.x** | Fast, flexible web framework with native async error handling |
| **ORM** | **Prisma ORM** | Type-safe database queries, schema migrations, and client generation |
| **Database** | **PostgreSQL** | Relational database engine for multi-tenant data integrity |
| **Authentication** | **JWT (jsonwebtoken)** | Signed authentication tokens with configurable expiration |
| **Security** | **Helmet, CORS, Express-Rate-Limit** | HTTP header hardening, origin whitelisting, and brute-force protection |
| **Logging** | **Morgan + Custom Logger** | HTTP request tracing and error logging |

---

## 🏛️ Multi-Tenant Data & Security Model

```text
SUPERADMIN (Platform Level)
   │
   ├── Manages Organizations, SaaS Plans & System Telemetry
   │
ORGANIZATION (Tenant Level: e.g. "Apex Estates")
   │
   ├── USERS & STAFF (Assigned Roles & Granular Permissions)
   │
   ├── PROPERTIES (Residential, Commercial, PG)
   │      │
   │      └── UNITS (Flats, Rooms, Offices)
   │
   ├── TENANTS (Profiles, ID Proofs, Contact Details)
   │      │
   │      └── LEASES (Contracts, Rent Amount, Due Dates)
   │
   └── PAYMENTS (Recorded Rent Transactions, Partial/Full Settlements)
```

---

## 📁 Backend Directory Structure

```
server/
├── prisma/
│   ├── schema.prisma          # Database models, relations, enums & indexes
│   └── seed.js                # Seed script for SuperAdmin, demo landlord, plans & roles
├── src/
│   ├── common/
│   │   ├── config/            # Environment configurations (env.js)
│   │   ├── constants/         # App constants, roles, and status enums
│   │   ├── errors/            # ApiError class, NotFoundError, UnauthorizedError
│   │   ├── guards/            # authenticate.guard.js, admin.guard.js, rbac.guard.js
│   │   ├── middlewares/       # errorHandler.js, validate.js, rateLimiter.js
│   │   └── utils/             # apiResponse.js, logger.js, dateUtils.js
│   ├── modules/
│   │   ├── admin/             # SuperAdmin controller, service, repository & routes
│   │   ├── auth/              # Mobile OTP login, token verification, logout
│   │   ├── organizations/     # Organization CRUD, quota limits & management
│   │   ├── plans/             # SaaS pricing plans (Public + Admin management)
│   │   ├── properties/        # Property portfolio management
│   │   ├── units/             # Individual rental units within properties
│   │   ├── tenants/           # Tenant profiles & identity management
│   │   ├── leases/            # Rental contracts, terms & deposits
│   │   ├── payments/          # Rent ledger, settlement, overdue calculations
│   │   ├── roles/             # Dynamic RBAC roles & permission matrix
│   │   └── users/             # User directory & profile updates
│   ├── app.js                 # Express application setup, middlewares & router mounts
│   └── server.js              # Server bootstrapper & database connection handler
├── .env.example
├── package.json
└── README.md
```

---

## 🌐 Complete API Endpoints Directory

All API routes are prefixed under `/api/v1`:

### 1. Public Endpoints (No Auth Required)
- `GET  /api/v1/health` — System uptime and health status
- `GET  /api/v1/plans` — List active SaaS subscription plans for the public website
- `GET  /api/v1/plans/:id` — View details of a specific subscription plan

### 2. Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/send-otp` — Generate and dispatch 6-digit OTP to mobile number
- `POST /api/v1/auth/verify-otp` — Verify OTP and issue JWT access token
- `GET  /api/v1/auth/me` — Fetch current authenticated user profile & active role permissions
- `POST /api/v1/auth/logout` — Invalidate user session

### 3. SuperAdmin Control Hub (`/api/v1/admin`) — *Requires SuperAdmin*
- `GET    /api/v1/admin/overview` — Platform KPI summary (Total Orgs, Units, MRR, Health)
- `GET    /api/v1/admin/organizations` — List all registered multi-tenant organizations
- `POST   /api/v1/admin/organizations` — Manually provision new organization
- `DELETE /api/v1/admin/organizations/:id` — Remove an organization and cleanup records
- `GET    /api/v1/admin/plans` — Manage platform subscription plans
- `POST   /api/v1/admin/plans` — Create new subscription plan with custom quotas
- `GET    /api/v1/admin/users` — Cross-tenant user directory
- `GET    /api/v1/admin/subscriptions` — Active platform subscriptions & expirations
- `GET    /api/v1/admin/telemetry` — Live system telemetry, API latencies & memory usage
- `GET    /api/v1/admin/audit-logs` — Immutable platform-wide security audit trail

### 4. Properties & Units (`/api/v1/properties`)
- `GET    /api/v1/properties` — List organization properties (filtered by search/status)
- `POST   /api/v1/properties` — Create new rental property
- `GET    /api/v1/properties/:id` — Get detailed property record with units and occupancy
- `PUT    /api/v1/properties/:id` — Update property details
- `DELETE /api/v1/properties/:id` — Archive or delete property

### 5. Tenants & Leases (`/api/v1/tenants`)
- `GET    /api/v1/tenants` — List tenants with active lease information
- `POST   /api/v1/tenants` — Register new tenant and bind to property unit
- `GET    /api/v1/tenants/:id` — View tenant profile, payment ledger, and lease agreement
- `PUT    /api/v1/tenants/:id` — Update tenant contact info or lease terms
- `DELETE /api/v1/tenants/:id` — Terminate lease or remove tenant record

### 6. Rent Payments & Billing (`/api/v1/payments`)
- `GET    /api/v1/payments` — Get payment transaction ledger (filters: month, status)
- `POST   /api/v1/payments` — Record new rent payment (Cash, UPI, Net Banking)
- `PUT    /api/v1/payments/:id/settle` — 1-Click instant payment settlement to `PAID`
- `GET    /api/v1/payments/summary` — Aggregate revenue collected, pending, and overdue dues

### 7. RBAC Roles & Team Settings (`/api/v1/roles`)
- `GET    /api/v1/roles` — List organization custom and system roles
- `POST   /api/v1/roles` — Create new custom role with granular permission keys
- `PUT    /api/v1/roles/:id` — Modify permissions for an existing role

---

## 🗄️ Prisma Database Schema Overview

The database schema (`prisma/schema.prisma`) enforces relational integrity across:
- **`Organization`**: Multi-tenant root entity containing name, slug, status, and quotas.
- **`User`**: System identities with phone, email, name, `isSuperAdmin` flag.
- **`Role` & `Permission`**: Granular role-based capability mapping.
- **`Property` & `Unit`**: Physical properties and individual rentable spaces.
- **`Tenant` & `Lease`**: Renter profiles and enforceable contractual lease agreements.
- **`Payment`**: Financial records with amount, payment mode, status, and audit timestamps.
- **`Plan` & `Subscription`**: SaaS packaging, prices, limits, and tenant entitlement.
- **`AuditLog`**: Tamper-evident activity logs for sensitive state changes.

---

## 🚀 Environment Variables & Setup Guide

### 1. Prerequisites
- Node.js (v20+)
- PostgreSQL server running locally or hosted

### 2. Environment Configuration
Create a `.env` file in the `server` root directory:
```env
# Server Runtime
PORT=5000
NODE_ENV=development

# Database Connection
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rentmate_db?schema=public"

# Authentication Security
JWT_SECRET="your-super-secure-jwt-secret-key-rentmate-2026"
JWT_EXPIRES_IN="7d"

# CORS Allowed Origin
CORS_ORIGIN="http://localhost:5173"
```

### 3. Installation & Database Migration
```bash
cd server
npm install

# Run Prisma Migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# Seed Database with Default Plans & SuperAdmin
node prisma/seed.js
```

### 4. Start Server
```bash
# Development Mode (Hot Reload with nodemon)
npm run dev

# Production Mode
npm start
```

Server will boot up and be accessible at **[http://localhost:5000](http://localhost:5000)**.

---

## 👨‍💻 Author & Maintenance

<div align="center">

| Author | Contact | Location | GitHub |
| :---: | :---: | :---: | :---: |
| **Bharat Pareek** | **bharatpareek256@gmail.com** <br/> `+91 8003953815` | Jaipur, Rajasthan, India | [**@bharat468**](https://github.com/bharat468) |

<br />

<sub>RentMate Platform Backend © 2026. All rights reserved.</sub>

</div>
