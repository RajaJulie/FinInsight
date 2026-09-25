# 💰 FinInsight

> A Full Stack personal finance management application built with Next.js, TypeScript, Prisma and PostgreSQL.

🚧 **Project currently under active development.**

---

## 📖 About the project

FinInsight is a Full Stack web application designed to help users manage and understand their personal finances through a modern and intuitive interface.

The application allows users to:

- Track income and expenses
- Manage multiple financial accounts
- Organize and categorize transactions
- Transfer money between accounts
- Create monthly budgets
- Monitor account balances
- Visualize financial activity through a dashboard

This project was created to strengthen my Full Stack development skills by building a complete application inspired by real-world personal finance platforms.

---

## ✨ Features

### 🔐 Authentication

- User registration and login
- Secure password hashing with bcrypt
- Authentication with Auth.js
- Protected routes
- User-specific financial data

### 📊 Dashboard

- Financial overview
- Available balance summary
- Income and expense statistics
- Expense distribution by category
- Financial charts
- Recent transaction overview

### 💳 Accounts

- Create and manage financial accounts
- Support for different account types
- Track individual account balances
- Set a primary account
- Archive accounts
- Internal transfers between accounts

### 💸 Transactions

- Create transactions
- Update transactions
- Delete transactions
- Income and expense management
- Associate transactions with accounts and categories
- Internal transfers between accounts
- Search and filter transactions

### 🏷️ Categories

- Manage transaction categories
- Associate categories with expenses and income
- Category-based financial analysis
- Expense distribution by category

### 🎯 Budgets

- Create monthly budgets
- Associate budgets with categories
- Track spending against a budget
- Calculate remaining budget
- Monitor budget progress

### 🚧 Currently in development

- Financial goals
- Advanced financial insights
- Data export
- Notifications
- Bank account connections
- Shared financial spaces

---

## 🛠 Tech Stack

### Front-End

- Next.js 15
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

### Back-End

- Next.js API Routes
- Auth.js
- Prisma ORM
- Server-side validation

### Database

- PostgreSQL

### Development Tools

- Docker
- Git / GitHub
- Postman
- VS Code

---

## 🏗 Architecture

```text
                 User
                   │
                   ▼
          React / Next.js
                   │
                   ▼
          Next.js API Routes
                   │
          Authentication
             (Auth.js)
                   │
                   ▼
              Prisma ORM
                   │
                   ▼
              PostgreSQL
```

FinInsight follows a Full Stack architecture where:

- **React and Next.js** provide the user interface.
- **Next.js API Routes** handle server-side business logic.
- **Auth.js** manages authentication and user sessions.
- **Prisma** provides database access through an ORM.
- **PostgreSQL** stores users and financial data.

---

## 📂 Project Structure

```text
frontend/
│
├── app/
│   ├── accounts/
│   ├── api/
│   │   ├── accounts/
│   │   ├── budgets/
│   │   ├── categories/
│   │   ├── dashboard/
│   │   └── transactions/
│   ├── categories/
│   ├── dashboard/
│   ├── login/
│   ├── signup/
│   └── transactions/
│
├── components/
├── hooks/
├── lib/
├── prisma/
├── public/
│
├── auth.ts
├── prisma.config.ts
├── package.json
└── tsconfig.json
```

---

## 🔒 Security

FinInsight includes several security mechanisms:

- Authentication using Auth.js
- Password hashing with bcrypt
- Protected application routes
- Protected API routes
- User ownership verification
- Server-side input validation
- Environment variables for sensitive configuration
- User data isolation

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/FinInsight.git
cd FinInsight/frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file and configure the required environment variables:

```env
DATABASE_URL=
AUTH_SECRET=
```

### 4. Apply database migrations

```bash
npx prisma migrate deploy
```

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Start the development server

```bash
npm run dev
```

---

## 📅 Roadmap

- [x] User authentication
- [x] Protected user sessions
- [x] Dashboard
- [x] Transactions CRUD
- [x] Categories management
- [x] Multiple account management
- [x] Internal transfers
- [x] Monthly budgets
- [ ] Financial goals
- [ ] Advanced financial insights
- [ ] Data export
- [ ] Notifications
- [ ] Bank account connections
- [ ] Shared financial spaces

---

## 🎯 Why this project?

I created FinInsight to strengthen my Full Stack development skills by designing and implementing a complete financial application.

Throughout this project, I focused on:

- Designing a scalable Full Stack architecture
- Building REST-style API endpoints
- Managing relational data with Prisma and PostgreSQL
- Implementing authentication and authorization
- Applying business rules to financial data
- Validating and securing server-side operations
- Building reusable React components
- Creating a modern and responsive user interface

---

## 👩‍💻 Author

**Julie Rajaratnam**

Full Stack Developer