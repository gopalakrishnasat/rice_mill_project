# 🌾 Rice Mill Management System (ERP)

A modern, enterprise-grade **Private Rice Mill ERP Management System** built on an **Nx Monorepo**, featuring an **Angular** frontend, a scalable **NestJS** backend, and **MongoDB** database.

---

## 1. Core Architectural Principles

- **Private Business ERP (Zero Public Self-Registration)**: The application is restricted to mill employees and authorized personnel. There is **no public sign-up or registration route**. All accounts are provisioned and governed by authorized administrators (`SUPER_ADMIN`, `ADMIN`).
- **Super Admin System Protection & Setup Lockdown**:
  - `GET /api/setup/status`: Inquires whether the initial Super Admin has been provisioned.
  - `POST /api/setup/initial-super-admin`: Allows creating the first Super Admin during initial deployment. Once created, the setup endpoint is **permanently locked down** (returns `403 Forbidden`).
  - Regular `ADMIN` accounts cannot create, promote, modify, or deactivate `SUPER_ADMIN` accounts.
  - The system strictly forbids deactivating the only remaining Super Admin.
- **Role-Based Access Control (RBAC) & Granular Permissions**: Multi-tier operational roles with backend enforcement via `@Roles()` and `@RequirePermissions()` decorators and guards.
- **Account Inactivity Governance**: Users have active/inactive status. Deactivation preserves operational and audit trails while immediately revoking login privileges.
- **Audit Logging Foundation**: Dedicated `AuditLog` collection automatically tracking user logins, login failures, employee provisioning, role alterations, deactivations, and password resets.

---

## 2. Technology Stack

### Frontend (`apps/frontend`)
- **Framework**: Angular (Standalone Components, Signals, Reactive Forms)
- **Styling**: SCSS Design System with Google Fonts (*Outfit* & *Plus Jakarta Sans*)
- **Routing & State**: Angular Router with `authGuard`, `guestGuard`, and `authInterceptor`
- **Design Language**: Custom agricultural enterprise aesthetic (Deep Forest Green, Paddy Harvest Gold)

### Backend (`apps/backend`)
- **Framework**: NestJS (Modular Architecture, Dependency Injection, Validation Pipes)
- **Database**: MongoDB + Mongoose Schema Modeling
- **Security**: Passport JWT Strategy (`@nestjs/jwt`, `@nestjs/passport`), `bcrypt` password hashing
- **Exception & Response Handling**: Centralized `AllExceptionsFilter` and `TransformInterceptor`
- **Auditing & Governance**: `AuditModule` with automated event interception

### Shared Library (`libs/shared-types`)
- Shared TypeScript interfaces, DTOs, Enums (`UserRole`, `Permission`, `ROLE_PERMISSIONS`), and API envelope contracts (`ApiResponse<T>`).

---

## 3. System Roles & Provisioned Test Accounts

The backend seeder automatically provisions test accounts for the core enterprise roles on startup:

| Role | Email | Password | Employee ID | Scope / Department |
| :--- | :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `superadmin@ricemill.com` | `SuperAdmin@123` | `EMP-001` | Executive ERP Governance & Full Access |
| **ADMIN** | `admin@ricemill.com` | `Admin@123` | `EMP-002` | Mill Operations, Customers, Products & Invoices |
| **VIEW_ONLY_ADMIN** | `viewer@ricemill.com` | `Viewer@123` | `EMP-003` | View-Only Access & Statement/Invoice Printing |

---

## 4. API Endpoints Reference

### Setup & Bootstrap (`/api/setup`)
- **`GET /api/setup/status`**: Inquires if Super Admin exists.
- **`POST /api/setup/initial-super-admin`**: Provisions the first Super Admin when `superAdminExists === false`. Permanently disabled once initialized.

### Authentication (`/api/auth`)
- **`POST /api/auth/login`**: Authenticates credentials, verifies `isActive`, records `lastLoginAt`, and returns JWT accessToken with user profile and permissions.
- **`GET /api/auth/me`**: Returns authenticated user profile and assigned permissions.
- **`POST /api/auth/forgot-password`**: Accepts `{ email }` and dispatches password recovery request without leaking email existence.

### Admin User Management (`/api/users`)
*Requires `SUPER_ADMIN` or `ADMIN` authentication token*
- **`POST /api/users`**: Creates a new employee account (`employeeId`, `name`, `email`, `mobile`, `password`, `role`). Enforces Super Admin hierarchy protection.
- **`GET /api/users`**: Lists users with optional filters (`?role=`, `?isActive=`, `?search=`).
- **`GET /api/users/:id`**: Retrieves user profile details.
- **`PATCH /api/users/:id/status`**: Activates or deactivates an employee account (`{ isActive: boolean, reason?: string }`). Prevents deactivating the only Super Admin.
- **`PATCH /api/users/:id/role`**: Updates an employee's assigned role (`{ role: UserRole }`).
- **`POST /api/users/:id/reset-password`**: Forces a password reset for an employee.

---

## 5. Quick Start Instructions

### Prerequisites
- Node.js `v20.x` or higher
- MongoDB running locally on port `27017`

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Backend Service
```bash
npx nx serve backend
```
> Running on **`http://localhost:3000/api`**

### 3. Start Frontend Portal
```bash
npx nx serve frontend
```
> Running on **`http://localhost:4200`**

### 4. Run Production Builds
```bash
npx nx build backend
npx nx build frontend --configuration=production
```

---

## 6. Project Monorepo Structure

```text
rice_mill_project/
├── apps/
│   ├── frontend/                         # Angular 22 Enterprise App
│   │   ├── public/
│   │   │   └── assets/images/           # High-resolution mill hero imagery
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── core/
│   │   │   │   │   ├── guards/          # authGuard, guestGuard
│   │   │   │   │   ├── interceptors/    # authInterceptor (Bearer token attachment)
│   │   │   │   │   ├── models/          # Shared type bindings
│   │   │   │   │   └── services/        # AuthService (Signal-based state & RBAC)
│   │   │   │   ├── features/
│   │   │   │   │   ├── auth/login/      # Login Component + Forgot Password Modal
│   │   │   │   │   └── dashboard/       # Dashboard Placeholder with RBAC details
│   │   │   │   ├── app.config.ts        # App providers
│   │   │   │   └── app.routes.ts        # Route declarations
│   │   │   └── styles.scss              # Global design system & tokens
│   │   ├── project.json
│   │   └── proxy.conf.json
│   │
│   └── backend/                          # NestJS Backend Application
│       ├── src/
│       │   ├── app/
│       │   │   ├── auth/                # AuthController, AuthService, JwtStrategy, Guards
│       │   │   ├── users/               # UsersController, UsersService, UserSchema
│       │   │   ├── setup/               # SetupController (Initial Super Admin bootstrap)
│       │   │   ├── common/
│       │   │   │   ├── audit/           # AuditLog schema & AuditService
│       │   │   │   ├── filters/         # Centralized AllExceptionsFilter
│       │   │   │   ├── interceptors/    # Standardized TransformInterceptor
│       │   │   │   └── seed/            # SeedService (Multi-role bootstrap seeder)
│       │   │   └── app.module.ts
│       │   └── main.ts
│       ├── .env
│       └── project.json
│
├── libs/
│   └── shared-types/                     # Shared TypeScript contracts, DTOs & Permissions
│       └── src/lib/shared-types.ts
│
├── nx.json
├── package.json
└── README.md
```
