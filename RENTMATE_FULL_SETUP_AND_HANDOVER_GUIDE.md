# RENTMATE — Complete Setup, Installation & Handover Guide
**Version 1.0 | Professional Developer & Deployment Documentation**

---

## 1. Executive Summary & Project Architecture

**RENTMATE** ek complete full-stack Rental Property Management & SaaS Marketplace Platform hai jisme:
- **Property Owners / Landlords**: Apni properties, buildings, flats, rooms, aur commercial shops ko manage kar sakte hain, tenants onboard kar sakte hain, rent rules set kar sakte hain aur payments track kar sakte hain.
- **Tenants / Renters**: Apne registered mobile number se OTP login karke apni rented properties, payment receipts, invoices aur maintenance complaints dekh sakte hain.
- **SuperAdmin Control Center**: Pure platform ke organizations, SaaS subscription plans, global users, RBAC permissions aur lifecycle automation ko govern kar sakta hai.

### Tech Stack:
- **Backend (`/server`)**: Node.js, Express.js (ES Modules), Prisma ORM, PostgreSQL, JWT Authentication, Zod / Custom Validations, Jest, Pino Logger.
- **Frontend (`/clint`)**: React 18, TypeScript, Vite, Tailwind CSS, Redux Toolkit, React Router v6, jsPDF + AutoTable, Lucide Icons.

---

## 2. System Prerequisites

Naye machine ya server par project run karne se pehle ye tools installed hone chahiye:

1. **Node.js**: `v18.18.0` ya higher (Recommended: Node `v20.x` LTS). Check with:
   ```bash
   node -v
   npm -v
   ```
2. **PostgreSQL**: Version 14, 15, ya 16 running locally ya hosted (e.g., Supabase, Neon, AWS RDS, Render, Railway).
   - Default local port: `5432`
   - Default user: `postgres`
3. **Git**: Installed for version control.

---

## 3. Directory Structure

Project 2 main folders me divided hai:
```text
Project/
├── clint/                 # React + TypeScript + Vite Frontend App
│   ├── src/
│   │   ├── app/           # Redux store & React Router definitions
│   │   ├── components/    # Layouts, Navbar, Sidebar, Global Search, UI components
│   │   ├── features/      # Modular pages (properties, tenants, payments, superadmin, etc.)
│   │   ├── services/      # Axios client & central API endpoint contracts
│   │   └── lib/           # Utility helpers, PDF invoice generators, permissions
│   ├── scripts/           # Automated frontend test runner (test_frontend.js)
│   ├── package.json
│   └── .env
│
├── server/                # Node.js + Express + Prisma Backend App
│   ├── prisma/
│   │   ├── schema.prisma  # Full PostgreSQL database relational models
│   │   └── seed.js        # Automated dummy/mock data generator script
│   ├── src/
│   │   ├── modules/       # Auth, properties, units, tenants, leases, payments, admin, cron
│   │   ├── common/        # Validators (Zod request schemas), Guards (admin.guard, plan.guard), logger
│   │   └── server.js      # Express server entry point
│   ├── tests/             # 12 Jest test suites (105 tests covering all validation, security, and lifecycle edge cases)
│   ├── scripts/           # Full system diagnostic runner (test_full_system.js)
│   ├── package.json
│   └── .env
│
└── RENTMATE_FULL_SETUP_AND_HANDOVER_GUIDE.md
```

---

## 4. Environment Variables (`.env`) Configuration

### A. Backend Environment File (`server/.env`)
`server` folder ke root me `.env` file create karein:

```env
# Server Environment
NODE_ENV=development
PORT=5000

# PostgreSQL Connection String
# Format: postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>?schema=public
DATABASE_URL="postgresql://postgres:1234@localhost:5432/rentmate_dev?schema=public"

# JWT Authentication Secret & Token Expiry
JWT_SECRET="rentmate_super_secret_jwt_key_2026_dev_mode"
JWT_EXPIRES_IN="7d"
```

> **Note**: Agar aapka PostgreSQL password `1234` ke alawa kuch aur hai, ya database name alag hai to `DATABASE_URL` me update karein.

---

### B. Frontend Environment File (`clint/.env`)
`clint` folder ke root me `.env` file create karein:

```env
# Backend API Base URL
VITE_API_URL=http://localhost:5000/api/v1
```

---

## 5. Step-by-Step Installation & Database Setup

### Step 1: PostgreSQL me Database Create Karein
Apne PostgreSQL tool (pgAdmin, DBeaver, ya `psql` shell) me database banayein:
```sql
CREATE DATABASE rentmate_dev;
```

---

### Step 2: Backend Dependencies Install & Database Migrate Karein
Terminal open karke `server` folder me navigate karein:

```bash
cd server
npm install
```

Prisma schema se tables create karne ke liye:
```bash
npx prisma generate
npx prisma migrate dev --name init
```
*(Yeh command sabhi tables jaise Users, Organizations, Properties, Units, Leases, Payments, Subscriptions, MaintenanceRequests create karegi).*

---

### Step 3: Dummy / Mock Data Populate Karein (Seed Script)
Backend me ready-to-use dummy seed script available hai jo complete production-like mock data insert karti hai:

```bash
npm run db:seed
```
Is script ko run karne par database me automatically create ho jayega:
- 25+ Granular RBAC Permissions (Property, Unit, Tenant, Finance, Maintenance).
- Global System Roles (Owner, Property Manager, Accountant, Staff).
- SuperAdmin Account & Demo Landlord Organization ("Bharat Estates").
- 4 SaaS Subscription Plans (Free Starter, Pro Plus, Growth Tier, Enterprise).
- Demo Properties, Multi-unit Flats, Rent Schedules, Leases, Ledgers aur Complaint Tickets.

---

### Step 4: Frontend Dependencies Install Karein
Doosra terminal open karke `clint` folder me jayein:

```bash
cd clint
npm install
```

---

## 6. How to Run the Application Locally

Dono servers ko development mode me chalane ke liye 2 terminals use karein:

### Terminal 1: Backend Server Start Karein
```bash
cd server
npm run dev
```
- **Backend API**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/health`

### Terminal 2: Frontend App Start Karein
```bash
cd clint
npm run dev
```
- **Frontend App**: `http://localhost:5173`

---

## 7. Default Login Credentials & Test Accounts

RENTMATE me **Passwordless OTP-based Authentication** use hoti hai:

### Login Flow:
1. Browser me `http://localhost:5173` open karein.
2. Niche diye gaye kisi bhi test number ko enter karein aur **"Send OTP"** dabayein.
3. Development mode me OTP **Backend Terminal Console** me print hota hai:
   ```text
   ------------------------------------------------------------
     RENTMATE DEV OTP
     Mobile: 9876543210
     OTP:    588256
     Valid:  5 minutes
   ------------------------------------------------------------
   ```
4. Terminal se 6-digit OTP dekh kar UI me enter karein aur Login karein!

### Pre-seeded Test Accounts:

| Role | Mobile Number | Name | Access Level / Workspace |
| :--- | :--- | :--- | :--- |
| **SuperAdmin Master** | `8003953815` | SuperAdmin Master | Full Platform Access (`/superadmin`) |
| **Landlord / Owner** | `9876543210` | Bharat | Landlord Portfolio (`/dashboard`) |
| **Tenant / Normal User**| `9999900001` | Rahul Sharma | Tenant Rental Portal (`/tenant/my-rentals`) |
| **Unregistered User** | Any 10-digit number | New User | Direct registration and onboarding |

---

## 8. Automated Testing & Health Check Scripts

Project me automated testing scripts pehle se configured hain jinhe koi bhi naya developer chala kar system health verify kar sakta hai:

### A. Backend Full System & Database Diagnostics
```bash
cd server
npm run test:system
```
Yeh script verify karti hai:
- Active PostgreSQL database connection.
- 8 Core tables integrity & live record counts.
- **11 Jest Test Suites (96 Tests)** covering:
  - Input validations & boundary checks.
  - Multi-tenant data isolation (Landlord A cannot access Landlord B's data).
  - SaaS Plan limits and expired subscription guards.
  - Automated Cron engine: Grace periods, late fee calculation and maximum penalty caps.
  - Reports divide-by-zero resilience.

### B. Regular Backend Jest Run
```bash
cd server
npm test
```

### C. Frontend Automated Type & Build Verification
```bash
cd clint
npm test
```
Yeh script verify karti hai:
- Strict TypeScript compilation (`tsc -b` with 0 errors).
- All 27 core components existence and router mapping.
- Financial reports calculation math (collection rates, margins).
- Production asset bundle integrity.

---

## 9. Key Modules & Functional Guide

1. **Dashboard (`/dashboard`)**:
   - Occupancy rate progress, rent collected vs pending dues.
   - Clickable KPI metric cards jo seedha `/properties`, `/tenants`, aur `/payments` par navigate karte hain.
2. **Properties & Units (`/properties`)**:
   - Building creation with address, city, BHK, and rent.
   - Multi-unit management modal (Flats, Rooms, Shops) with marketplace publishing.
3. **Tenants & Leases (`/tenants`, `/applications`)**:
   - Walk-in tenant registration, lease activation, dynamic rent rule configuration.
4. **Payments & Defaulters (`/payments`)**:
   - Offline payment recording, monthly billing cycles, real-time status badges (`PAID`, `PENDING`, `OVERDUE`).
   - One-click Official Rent Invoice / Bill PDF download with company branding.
5. **Financial & Operational Reports (BRD Sec 25)**:
   - Dashboard me **"Export Reports"** button par click karke Monthly Collection Report, Defaulters List, aur Property P&L Report dekh sakte hain.
   - One-click **Export to CSV** aur **Export to PDF** dono options available hain.
6. **Universal Global Search (`⌘K` / `Ctrl+K`)**:
   - Header me search bar par click karein ya keyboard shortcut press karein.
   - Live search across Properties, Tenants, Payments, aur Navigation Shortcuts.
7. **Automated Lifecycle Cron Jobs**:
   - Daily cron service automatically promotes `UPCOMING` $\rightarrow$ `DUE` $\rightarrow$ `OVERDUE` schedules, assesses daily late fees, aur expired subscriptions ko flag karti hai.
   - SuperAdmin manual run endpoint: `POST /api/v1/admin/cron/run`.

---

## 10. Production Deployment & Build Commands

### Frontend Production Build:
```bash
cd clint
npm run build
```
Outputs static assets into `clint/dist/` jise Vercel, Netlify, Cloudflare Pages, ya Nginx par deploy kiya ja sakta hai.

### Backend Production Start:
```bash
cd server
npm run start
```
PM2, Docker, ya Render/Railway background process ke through run karein.

---

## 11. Troubleshooting & Common Questions (FAQ)

### Q1: `npx prisma migrate dev` fails with connection error?
- Check karein ki PostgreSQL service running hai ya nahi (`services.msc` on Windows ya `sudo systemctl status postgresql` on Linux).
- Verify karein ki `server/.env` me `DATABASE_URL` ka username, password, port aur database name match ho rahe hain.

### Q2: Dev mode me OTP mobile par kyu nahi aa raha?
- Development environment me external SMS charges bachane ke liye OTP **Backend Terminal console** me automatically print hota hai.
- Production deployment ke waqt `.env` me Fast2SMS ya Twilio credentials hook karke real SMS delivery enable ki ja sakti hai (`server/src/modules/auth/auth.service.js`).

### Q3: Frontend par CORS error aa raha hai?
- Confirm karein ki `server/.env` me port `5000` set hai aur `clint/.env` me `VITE_API_URL=http://localhost:5000/api/v1` hai.

---

*Documentation maintained by Bharat | RentMate Smart Rentals*
