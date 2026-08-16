# SecureBank — Product Requirements Document

## Original Problem Statement
Build a professional full-stack Online Banking Management System ("SecureBank"). Requested MERN; backend implemented in **Node.js + Express** per user's explicit choice (adapted to this environment). React frontend, MongoDB, JWT auth, bcrypt. INR currency, recharts line + bar charts, demo admin + user seeded.

## Architecture
- **Frontend**: React 19 (CRA/craco), Tailwind, recharts, sonner toasts, react-router-dom. Token (JWT) stored in localStorage (`sb_token`).
- **Backend**: Node.js + Express + Mongoose on port 8001, all routes prefixed `/api`. Supervisor reconfigured to run `node --watch server.js`.
- **DB**: MongoDB (`MONGO_URL` + `DB_NAME` from env). Models: User, Account, Transaction, Beneficiary.
- **Auth**: JWT (7d) + bcrypt. `protect` and `adminOnly` middleware. Admin + demo user seeded on startup.

## User Personas
- **Customer**: manages accounts, deposits/withdraws/transfers, beneficiaries, views history + analytics.
- **Admin**: monitors all users/accounts/transactions and suspicious activity; suspend/activate users.

## Core Requirements (static)
Registration/login, JWT protected routes, profile mgmt, account creation, balance view, deposit, withdraw, transfer, beneficiaries, transaction history w/ search+filter, dashboard analytics, admin console, RBAC, insufficient-balance blocking, fraud detection (LOW/MEDIUM/HIGH).

## Implemented (2026-06)
- Auth: register (auto-opens savings account), login, /me — JWT + bcrypt. ✅
- Accounts: create, list, get, balance. ✅
- Transactions: deposit, withdraw (blocks insufficient), transfer (out+in, blocks insufficient, prevents same-account), list with search/type/amount/date filters, analytics (balance, received, transferred, monthly trend, category breakdown, recent, flagged count). ✅
- Fraud engine: large-amount (≥₹50k MEDIUM / ≥₹1L HIGH), rapid (3+ in 60s), >80% balance drain → risk level + reasons. ✅
- Beneficiaries: add (validates existing account, blocks own), list, delete. ✅
- Profile update. ✅
- Admin: stats overview, users table + suspend/activate, accounts table, transactions table w/ risk filter, suspicious tab w/ reasons. ✅ RBAC 403 enforced. ✅
- UI: dark-sidebar dashboard, split-screen auth, INR formatting, charts, loading/empty/error states, responsive. ✅
- Verified: 29/29 backend pytest + full Playwright frontend flows pass (100%).

## Known Notes / Backlog (non-blocking)
- P2: Transfers use two separate saves (Mongo standalone has no multi-doc txn support here); fine for demo.
- P2: No brute-force lockout on login.
- P2: Seed transactions created in the same second get tagged by the rapid-transaction rule (expected demo behavior).

## Test Credentials
- Admin: kanamkhushikumari1@gmail.com / Admin@12345
- Demo user: demo@securebank.com / User@12345
