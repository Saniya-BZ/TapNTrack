# TapNTrack
# Hotel RFID Access Control System

A comprehensive solution for hotel access management using RFID technology with a multi-role administrative dashboard.

---

## 📌 Overview

This system provides a secure and efficient way for hotels to manage guest access, monitor security, and streamline front desk operations while maintaining clear communication across all staff roles.

---

## 🚀 Features

- 🔐 **RFID card-based access control** for hotel rooms and facilities  
- 👥 **Role-based user management** with 4 roles: Super Admin, Admin, Manager, Clerk  
- 📝 **Guest registration with Aadhar verification** and room/card assignment  
- 🏨 **Room and card configuration** including types, restrictions, and packages  
- 📊 **Advanced analytics dashboards**: check-in trends, room frequency, activity charts  
- 🔎 **RFID entry logs** with detailed filtering by status, timestamp, room  
- 🗂️ **Access Groups**: customizable permission matrices for different card types  
- 💳 **Card Management**: register, activate, deactivate, or revoke cards  
- 📬 **Helpdesk module** for staff support, ticket tracking, and communication  
- 🌐 **Multi-language support**: English, Hindi, Telugu  
- 🔄 **Real-time updates** and activity monitoring  
- 📱 **Responsive design**: optimized for mobile, tablet, and desktop  
- 👤 **User profile settings** with password update and preferences  
- 🔐 **Secure authentication** with JWT tokens and 24-hour session expiration  
- 🧩 **Modular REST API** backend with extendable structure
- 👥 **AI Assistant ChatBot** answers to all the queries

---

## 👤 User Roles & Permissions

| Role         | Permissions                                                                 |
|--------------|------------------------------------------------------------------------------|
| Super Admin  | System-wide access (except Helpdesk), full user management                  |
| Admin        | Analytics, user management (except Super Admin), helpdesk, room/card config |
| Manager      | Limited analytics, clerk management, helpdesk, guest registration           |
| Clerk        | Guest registration, helpdesk ticket creation                                |

---

## 📄 Key Modules

### 🔐 Authentication System

- JWT-based login authentication
- Session tokens with 24-hour expiration
- Role-based access and route control

---

## 🛠️ Tech Stack

### Backend

- **Language**: Python (Flask)
- **Database**: PostgreSQL (via `psycopg2`)
- **API Type**: RESTful
- **Auth**: JWT tokens with session control
- **Security**: Password hashing, RBAC
- **CORS**: Enabled for frontend communication

### Frontend

- React (with React Router)
- React Bootstrap
- Context API for state management
- i18next for multi-language support

---

## 🧱 Database Tables

| Table Name             | Description                                  |
|------------------------|----------------------------------------------|
| `access_requests`      | Logs RFID access attempts                    |
| `productstable`        | Maps product IDs to rooms                    |
| `cardids`              | Links card IDs with rooms/facilities         |
| `users`                | Manages user accounts and roles              |
| `sessions`             | Tracks active session tokens                 |
| `guest_registrations`  | Guest data and room assignments              |
| `help_messages`        | Internal messaging and support tickets       |
| `card_packages`        | Defines card-based access packages           |
| `access_matrix`        | Permission definitions for card packages     |

---

## 🧭 System Pages Overview

### **Core Pages**

1. **Dashboard**  
   - Real-time KPIs, charts, and activity feed

2. **RFID Entries**  
   - Log of all access events with filters for status, location, time

3. **Register Guest**  
   - Guest check-in and RFID assignment

4. **Room Management**  
   - Configure rooms, assign restrictions, monitor use

5. **Check-in Trends**  
   - Time-based guest activity analytics

6. **Room Frequency**  
   - Shows most accessed rooms and usage heatmaps

---

### **Administrative Pages**

7. **User Management**  
   - Add/edit/delete users and assign roles

8. **Card Management**  
   - Register/manage RFID cards and their status

9. **Access Groups**  
   - Define permission groups and access rules

10. **Helpdesk**  
    - Internal support/ticket system for staff issues

---

### **Account Pages**

11. **Login**  
    - Secure login with role-based redirection

12. **Profile Settings**  
    - Update personal details and change passwords

---

## 🎯 Key Functional Highlights

### ✅ Access Control

- Validates card-room pairings
- Logs access attempts with timestamps and status

### 📊 Dashboard & Analytics

- Activity heatmaps
- Check-in trends and room frequency stats
- Denied vs. granted logs

### 👥 User Management

- Secure password hashing
- Full role management via Admin portal

### 🛏️ Room & Card Setup

- Create/edit/delete rooms
- Assign RFID card packages

### 📝 Guest Management

- Register/check-in guests
- Assign temporary or permanent access

### 💬 Helpdesk

- In-app ticketing for internal communication

### 👥 AI Assistant Chatbot
- In-app answers of the queries
