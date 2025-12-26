# Employee Management System (EMS)

A **modern, scalable Employee Management System (EMS)** designed to manage employee records, roles, departments, and organizational workflows efficiently.  
Built with a **high-performance frontend** and a **robust backend architecture** suitable for small to large organizations.

---

## Overview

The **Employee Management System (EMS)** provides a centralized platform to manage employee data, improve administrative efficiency, and ensure secure access to organizational records.

The system follows a **clean separation of concerns** with a React-based frontend and a Node.js backend powered by PostgreSQL.

---

## Key Features

### Employee Management
- Create, update, view, and delete employee records
- Employee profile management
- Department and designation assignment
- Employee status tracking (active/inactive)

### User & Role Management
- Role-based access control (Admin / Manager / Employee)
- Secure authentication & authorization
- Permission-based operations

### Administrative Tools
- Employee listing with search & filters
- Reporting-ready data structure
- Scalable API architecture

### Security & Performance
- Secure RESTful APIs
- PostgreSQL relational data integrity
- Type-safe frontend with TypeScript
- Optimized build using Vite

---

## Technology Stack

### Frontend
- React.js
- Vite
- TypeScript

### Backend
- Node.js
- Express.js

### Database
- PostgreSQL

---

## Project Structure

Employee-Management-System-EMS/
│
├── client/ # React + Vite frontend
│ ├── src/
│ ├── public/
│ └── vite.config.ts
│
├── server/ # Node.js backend
│ ├── src/
│ │ ├── controllers/
│ │ ├── routes/
│ │ ├── models/
│ │ └── services/
│ ├── config/
│ └── server.js
│
├── database/ # PostgreSQL schema & migrations
├── README.md
└── package.json

yaml
Copy code

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL
- npm or yarn

---

### Backend Setup

```bash
cd server
npm install
