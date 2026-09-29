# 🏢 RENTMATE — Backend Engineering Blueprint & Roadmap

> **Enterprise-Grade Rental Property Management Platform Backend**  
> Built with **Modern JavaScript (Node.js ES Modules)**, Express 5, Prisma ORM, and PostgreSQL.  
> Architecture: **Layered Clean Architecture (Controller-Service-Repository)** with a **100% Free Development Strategy**.

---

## 📑 Table of Contents
1. [Project Overview & Core Lifecycle](#-project-overview--core-lifecycle)
2. [Technology Stack](#-technology-stack)
3. [100% Free Development Strategy](#-100-free-development-strategy)
4. [Backend Architecture & Data Flow](#-backend-architecture--data-flow)
5. [Standard Folder Structure](#-standard-folder-structure)
6. [API Response & Error Standards](#-api-response--error-standards)
7. [The 9-Phase Backend Master Roadmap](#-the-9-phase-backend-master-roadmap)
8. [Current Status: Phase 1 Completed](#-current-status-phase-1-completed)
9. [Getting Started (Local Development)](#-getting-started-local-development)

---

## 🎯 Project Overview & Core Lifecycle

**RENTMATE** ek modern rental property management platform hai jiska backend complex financial rules, dynamic roles (RBAC), multi-unit properties, aur tenant leasing workflows ko handle karta hai.

### The Unbreakable Core Business Chain:
```text
PROPERTY (e.g. Sunrise Residency)
   │
   ▼
UNIT (e.g. Flat A-101, Shop S-01)
   │
   ▼
LISTING (Marketplace ad: ₹15,000/mo, deposit ₹30,000)
   │
   ▼
APPLICATION (Tenant applies with ID proofs)
   │
   ▼
OWNER APPROVAL (Screening & decision)
   │
   ▼
LEASE (Active contract with rules & duration)
   │
   ▼
RENT RULES (Due day: 5th, Grace: 2 days, Penalty: ₹100/day)
   │
   ▼
RENT SCHEDULES (Monthly rent generation: Upcoming -> Due -> Overdue)
   │
   ▼
PAYMENT (Online / Cash ledger: Partial or Full)
   │
   ▼
PENALTIES (Automated backend calculation)
   │
   ▼
MAINTENANCE (Tenant ticket lifecycle)
   │
   ▼
MOVE-OUT & DEPOSIT SETTLEMENT (Deductions & refunds)
```

---

## ⚙️ Technology Stack

- **Runtime**: Node.js (v20+ recommended)
- **Language**: Pure Modern JavaScript with native ES Modules (`"type": "module"`, `import/export`)
- **Web Framework**: Express 5.x
- **ORM / Database Tool**: Prisma ORM
- **Primary Database**: PostgreSQL (Local: `localhost:5432`)
- **In-Memory Cache & Queue**: Redis (Local: `localhost:6379`) + BullMQ
- **Environment & Input Validation**: Zod
- **Security & Headers**: Helmet, CORS, Express Rate Limit, bcrypt, jsonwebtoken
- **Logging**: Morgan (HTTP request logger) + Pino (Structured JSON logging)
- **Automated Testing**: Jest + Supertest

---

## 💡 100% Free Development Strategy

Is project ko initially **bina ₹1 kharch kiye** complete production-grade banaya ja raha hai:

| Feature / Service | Free Development Solution | Future Production Cloud Solution |
|---|---|---|
| **Database** | Local PostgreSQL (`localhost:5432`) | Supabase / AWS RDS / Neon |
| **Database GUI** | Prisma Studio (`npx prisma studio`) | Cloud DB Dashboard |
| **Cache & Queues** | Local Redis (`localhost:6379`) | Upstash Redis / AWS ElastiCache |
| **Authentication** | Mobile + Local OTP (Logged to Terminal Console) | Twilio / Fast2SMS / Firebase Auth |
| **Payment Gateway** | Mock Payment Provider (`/mock/pay`) | Razorpay (Webhooks + Signatures) |
| **File Storage** | Local File Storage (`/server/uploads/`) | AWS S3 / Cloudinary Presigned URLs |
| **Email Service** | Console Output / Ethereal Email | SendGrid / AWS SES / Resend |
| **Docker** | Docker Desktop (Local containers) | AWS ECS / DigitalOcean App Platform |

---

## 🏛️ Backend Architecture & Data Flow

Hum Controller mein direct database queries ya heavy logic nahi likhenge. Saara backend **4-Layered Clean Architecture** follow karta hai:

```text
HTTP Request (Client / Postman)
       │
       ▼
   [ Route ]            --> Route definition & HTTP verb matching
       │
       ▼
 [ Middleware ]        --> Auth check (JWT), Dynamic Permission check (RBAC), Zod Validation
       │
       ▼
 [ Controller ]        --> Extracts req.body, req.params, calls Service, sends standard ApiResponse
       │
       ▼
  [ Service ]          --> Authoritative Business Logic (Rent calculation, lease validation, checks)
       │
       ▼
 [ Repository/Prisma ] --> Direct PostgreSQL queries via Prisma ORM
       │
       ▼
   PostgreSQL
```

---

## 📁 Standard Folder Structure

```text
server/
├── docs/                        # Architecture diagrams & API documentation
├── tests/                       # Jest & Supertest integration tests
│   └── app.test.js
├── src/
│   ├── app.js                   # Express application setup & middleware assembly
│   ├── server.js                # Port listener & graceful shutdown handlers
│   │
│   ├── config/                  # Environment & core configuration
│   │   ├── app.config.js        # Helmet, CORS, JSON, Morgan
│   │   ├── database.config.js   # DB connection lifecycle
│   │   └── env.config.js        # Zod validated process.env
│   │
│   ├── common/                  # Shared cross-cutting modules
│   │   ├── errors/              # Custom error classes (ApiError)
│   │   ├── middleware/          # errorHandler, notFoundHandler, rateLimiter
│   │   ├── utils/               # ApiResponse, asyncHandler
│   │   ├── logger/              # Pino logger configuration
│   │   └── validators/          # Common Zod validation schemas
│   │
│   ├── modules/                 # Feature-based business domains
│   │   ├── auth/                # OTP, JWT, Login, Session
│   │   ├── organizations/       # Owner companies & scope
│   │   ├── rbac/                # Roles, Permissions, Scope guards
│   │   ├── properties/          # Property entity CRUD
│   │   ├── units/               # Unit entity & status
│   │   ├── listings/            # Marketplace rental posts
│   │   ├── applications/        # Tenant rental applications
│   │   ├── leases/              # Contracts & transactions
│   │   ├── finance/             # Rent rules, schedules, payments, penalties
│   │   ├── maintenance/         # Tickets & repairs
│   │   └── notifications/       # In-app alerts & background queues
│   │
│   └── routes/
│       └── v1/                  # API Version 1 central router
│           └── index.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 📡 API Response & Error Standards

Sabhi APIs ek predictable standard format follow karti hain:

### Success Response (`ApiResponse`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "RENTMATE API is running smoothly",
  "data": {
    "status": "ok",
    "service": "RENTMATE API",
    "uptime": 24.1,
    "timestamp": "2026-09-29T23:00:00.000Z"
  }
}
```

### Error Response (`ApiError`):
```json
{
  "success": false,
  "statusCode": 404,
  "message": "Route not found: GET /api/v1/unknown",
  "errors": []
}
```

---

## 🗺️ The 9-Phase Backend Master Roadmap

```text
┌────────────────────────────────────────────────────────┐
│ PHASE 1: Backend Foundation (Node.js ES Modules) [DONE]│
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 2: PostgreSQL + Prisma + Database Foundation    │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 3: Authentication + User System (Mobile + OTP)   │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 4: Organizations + Dynamic Scope-based RBAC      │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 5: Property + Unit + Category Engine             │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 6: Marketplace Listing + Application + Lease     │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 7: Financial Engine (Rent, Payment, Penalty)     │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 8: Maintenance + Local Files + Redis + BullMQ    │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ PHASE 9: Admin + Reports + Audit + Docker + Deploy     │
└────────────────────────────────────────────────────────┘
```

### Detailed Breakdown of Every Phase:

#### 🟢 Phase 1: Backend Foundation (Status: ✅ Complete)
- [x] Node.js ES Modules setup (`package.json`, `"type": "module"`)
- [x] Express 5 app setup with clean separation (`app.js` & `server.js`)
- [x] Graceful shutdown handling (`SIGINT`, `SIGTERM`)
- [x] Security headers with `helmet`, CORS configured
- [x] Environment validation with `zod` (`env.config.js`)
- [x] HTTP logging with `morgan` + Structured logging with `pino`
- [x] Global error handling (`errorHandler`, `notFoundHandler`, `ApiError`, `ApiResponse`)
- [x] Asynchronous error handler wrapper (`asyncHandler`)
- [x] Health check API (`GET /api/v1/health`)
- [x] Automated test suite passing with Jest & Supertest
- [x] Git repository initialized & first commit recorded

#### 🟡 Phase 2: PostgreSQL + Prisma + Database Foundation
- [ ] Local PostgreSQL installation & database creation (`rentmate_dev`)
- [ ] Prisma CLI setup (`prisma init --datasource-provider postgresql`)
- [ ] Database connection lifecycle (`database.config.js`)
- [ ] Initial Database Models (`User`, `Organization`)
- [ ] First Prisma Migration (`npx prisma migrate dev`)
- [ ] Prisma Studio testing & verification
- [ ] Base Repository & Service pattern implementation
- [ ] Seed data scripts for development

#### 🔵 Phase 3: Authentication + User System
- [ ] `auth` module structure (Routes, Controller, Service)
- [ ] `POST /api/v1/auth/send-otp` (Console OTP generator with 5 min TTL)
- [ ] `POST /api/v1/auth/verify-otp` (Validates OTP, creates/finds user)
- [ ] JWT Access Token & Refresh Token generation
- [ ] JWT authentication guard middleware (`auth.middleware.js`)
- [ ] `GET /api/v1/auth/me` (Profile retrieval)
- [ ] Logout & session invalidation
- [ ] Rate limiting on auth endpoints (prevents spam)

#### 🟣 Phase 4: Organization + Dynamic Scope-Based RBAC
- [ ] Organization creation for property owners/companies
- [ ] Role-Based Access Control tables (`Role`, `Permission`, `UserRole`, `RolePermission`)
- [ ] Granular permission keys (`property.create`, `payment.read`, `maintenance.update`)
- [ ] Dynamic roles (Owner can create custom roles like "Property Manager")
- [ ] Scope-based authorization (Manager assigned only to "Property A" cannot touch "Property B")
- [ ] Authorization guard middleware (`requirePermission`, `checkScope`)

#### 🟠 Phase 5: Property + Unit + Category Engine
- [ ] Property CRUD APIs (`/api/v1/properties`)
- [ ] Multi-unit support (`/api/v1/units` linked to Property)
- [ ] Unit lifecycle status (`VACANT`, `LISTED`, `OCCUPIED`, `MAINTENANCE`, `BLOCKED`)
- [ ] Hierarchical Categories (Residential -> Flat -> 2BHK; Commercial -> Shop, Warehouse)
- [ ] Unit specifications (Floor, square feet area, furnishing status)

#### 🔴 Phase 6: Marketplace Listing + Application + Lease
- [ ] Public Listing module (`/api/v1/listings`) with search, filter, and pagination
- [ ] Tenant profile onboarding
- [ ] Rental Application submission (`/api/v1/applications`) with status (`PENDING`, `APPROVED`, `REJECTED`)
- [ ] Lease generation upon approval (`/api/v1/leases`)
- [ ] Database Atomic Transaction (Lease Create + Rent Rule Create + Unit Status update to `OCCUPIED`)

#### 🟤 Phase 7: Financial Engine (Rent, Payment, Penalty, Deposit)
- [ ] Rent Rules (Monthly rent, due date, grace period, penalty rate)
- [ ] Automated Rent Schedule Generator (`rent_schedules`)
- [ ] Status workflow (`UPCOMING` -> `DUE` -> `PAID` / `PARTIALLY_PAID` / `OVERDUE`)
- [ ] Mock Payment Gateway Provider (`POST /api/v1/payments/mock/pay`)
- [ ] Cash Payment Ledger for on-site cash collections
- [ ] Authoritative Backend Penalty Calculation Engine
- [ ] Security Deposit tracking & Move-out deduction/refund settlement

#### 🟦 Phase 8: Maintenance + Local Documents + Redis + BullMQ
- [ ] Maintenance ticket module (`OPEN` -> `ASSIGNED` -> `IN_PROGRESS` -> `RESOLVED` -> `CLOSED`)
- [ ] Cost tracking for repairs
- [ ] Local file upload & retrieval service with mime-type validation
- [ ] Local Redis setup for high-speed caching & OTP storage
- [ ] BullMQ background jobs worker:
  - Daily Rent Reminder jobs
  - Automated Overdue & Penalty processor
  - Lease expiry notifications
- [ ] In-app notification system

#### ⚫ Phase 9: Admin + Reports + Audit + Testing + Docker
- [ ] Super Admin management dashboard APIs
- [ ] Financial Reports (Rent collected, pending rent, occupancy rate, property revenue)
- [ ] Immutable Audit Logs (`Who`, `Action`, `Entity`, `Timestamp`)
- [ ] Comprehensive End-to-End (E2E) integration test suites
- [ ] Production-ready Dockerfile & `docker-compose.yml` (PostgreSQL, Redis, API, Worker)
- [ ] Deployment checklist & Nginx reverse proxy configuration

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites:
- Node.js (v20+ recommended)
- Git

### 2. Installation:
```bash
cd server
npm install
```

### 3. Environment Setup:
Copy the example environment file:
```bash
cp .env.example .env
```
Default `.env` configuration:
```env
NODE_ENV=development
PORT=5000
```

### 4. Running the Development Server:
```bash
npm run dev
```
The server will start listening at: `http://localhost:5000`

### 5. Running Automated Tests:
```bash
npm test
```
All unit & integration tests will run using Jest and Supertest.

---

## 📌 Development Philosophy & Rules
1. **Free-First**: Do not introduce paid external APIs during active core feature development.
2. **Backend Authoritative**: Never trust frontend calculations for financial data, penalties, or access control.
3. **Layered Isolation**: Controllers handle HTTP, Services handle rules, Repositories handle database queries.
4. **Step-by-Step Evolution**: Complete and verify one phase at a time with automated tests and Git commits.
