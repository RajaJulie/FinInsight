# 💰 FinInsight

> A modern Full Stack personal finance management application built with Next.js.

🚧 **Project currently under active development.**

---

# 📖 About the project

FinInsight is a Full Stack web application designed to help users better manage their personal finances.

The application allows users to:

- Track income and expenses
- Organize financial transactions
- Monitor their financial balance
- Visualize financial data through dashboards
- Build better budgeting habits

This project was created to strengthen my Full Stack development skills by designing a complete application inspired by real-world financial platforms.

---

# ✨ Features

### Authentication

- Secure user authentication
- Password hashing with bcrypt
- Protected routes using Auth.js

### Dashboard

- Financial overview
- Balance summary
- Income & expense statistics
- Interactive dashboard

### Transactions

- Create transactions
- Update transactions
- Delete transactions
- Categorize transactions

### Currently in development

- Budget management
- Financial goals
- Expense analytics
- Advanced statistics
- Responsive improvements

---

# 🛠 Tech Stack

## Front-End

- Next.js 15 (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## Back-End

- Next.js API Routes
- Auth.js
- Prisma ORM

## Database

- PostgreSQL

## Tools

- Docker
- Git
- Postman
- VS Code

---

# 🏗 Architecture

```text
                User
                  │
                  ▼
      React / Next.js (Frontend)
                  │
                  ▼
        Next.js API Routes
                  │
        Authentication (Auth.js)
                  │
                  ▼
            Prisma ORM
                  │
                  ▼
            PostgreSQL
```

The application follows a modern Full Stack architecture where:

- React provides the user interface.
- Next.js handles both frontend and backend logic.
- Auth.js manages authentication.
- Prisma acts as the ORM.
- PostgreSQL stores application data.

---

# 📂 Project Structure

```text
frontend
│
├── app
│   ├── api
│   ├── dashboard
│   ├── login
│   ├── signup
│   └── transactions
│
├── components
├── hooks
├── lib
├── prisma
├── public
│
├── auth.ts
├── prisma.config.ts
├── package.json
└── tsconfig.json
```

### Folder description

| Folder | Description |
|---------|-------------|
| app | Application pages and API routes |
| components | Reusable React components |
| hooks | Custom React hooks |
| lib | Utility functions and shared configuration |
| prisma | Prisma schema and database configuration |
| public | Static assets |

---

# 🔒 Security

The project includes several security mechanisms:

- Secure authentication using Auth.js
- Password hashing with bcrypt
- Protected API routes
- User ownership verification
- Server-side validation
- Environment variables for sensitive data

---

# 🚀 Getting Started

Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/FinInsight.git
```

Install dependencies

```bash
npm install
```

Configure your environment variables

```env
DATABASE_URL=
AUTH_SECRET=
```

Run the development server

```bash
npm run dev
```

---

# 📅 Roadmap

- [x] Authentication
- [x] Dashboard
- [x] Transactions CRUD
- [x] User sessions
- [ ] Categories management
- [ ] Budget management
- [ ] Financial goals
- [ ] Expense analytics
- [ ] Export data
- [ ] Notifications

---

# 🎯 Why this project?

I created FinInsight to improve my Full Stack development skills by building a complete application similar to those used in real-world environments.

Throughout this project, I focused on:

- Designing a scalable architecture
- Building secure APIs
- Managing relational databases
- Implementing authentication
- Applying clean code principles
- Developing a modern user interface

---

# 👩‍💻 Author

**Julie Rajaratnam**

Full Stack Developer
