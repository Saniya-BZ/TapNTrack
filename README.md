# Hotel RFID Access Control System

A comprehensive solution for hotel access management using RFID technology with a multi-role administrative dashboard.

## Overview

This system provides a secure and efficient way for hotels to manage guest access, monitor security, and streamline front desk operations while maintaining clear lines of communication between different staff roles.


## Features

- 🔐 RFID card-based access control for hotel rooms
- 👥 Role-based user management (Super Admin, Admin, Manager, Clerk)
- 📝 Guest registration with Aadhar verification
- 🏨 Room and card mapping management
- 📊 Access analytics and reporting
- 🔔 Support helpdesk system for staff communication
- 📱 Responsive design for all devices

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Super Admin** | System-wide access (except Helpdesk), user management for all roles |
| **Admin** | Analytics, user management (except Super Admin), helpdesk support, room/card management |
| **Manager** | Limited analytics, clerk management, helpdesk support, guest registration |
| **Clerk** | Guest registration, helpdesk ticket creation |

## Key Modules

### Authentication System
- Secure JWT-based authentication
- Session management
- Role-based access control
- Session tokens are generated on login
- Tokens expire after 24 hours



## 🛠️ Tech Stack

- **Backend**: Python (Flask)
- **Database**: PostgreSQL (via psycopg2)
- **Authentication**: Session/token-based
- **API Type**: RESTful
- **Security**: Password hashing, role-based access control
- **CORS**: Enabled (for frontend communication)

### Frontend
- React with React Router
- React Bootstrap
- Context API for state management


### Backend
- Flask (Python)
- PostgreSQL database
- RESTful API architecture
- JWT authentication

---

## 🧱 Database Tables

| Table Name           | Description                                      |
|----------------------|--------------------------------------------------|
| `access_requests`    | Logs all RFID access attempts                    |
| `productstable`      | Maps product IDs to rooms                        |
| `cardids`            | Associates card IDs with rooms/facilities        |
| `users`              | Manages system users and their roles             |
| `sessions`           | Tracks session tokens                            |
| `guest_registrations`| Guest details and room assignments               |
| `help_messages`      | In-app messaging                                 |
| `card_packages`      | Access package definitions                       |
| `access_matrix`      | Permissions matrix for card packages             |

---


## 🎯 Key Features

### ✅ Access Control
- Validates card IDs and room permissions
- Logs every access attempt

### 📊 Dashboard
- Activity heatmaps
- Room usage stats
- Denied vs. granted attempts

### 👥 User Management
- Add/update/delete users
- Role assignment
- Password hashing

### 🏨 Room & Card Setup
- Configure rooms
- Assign cards and packages

### 📝 Guest Management
- Register/check-in guests
- Temporary access cards

### 📬 Help Desk
- Role-based internal messaging

---

## 🔌 API Endpoints (Partial List)

### 🔐 Authentication
- `POST /api/login`  
- `POST /api/logout`  
- `GET /api/check-session`

### 🧠 Access Processing
- `POST /access`  
- `GET /api/rfid_entries`  
- `GET /api/checkin_trends`

### 📈 Dashboard
- `GET /api/dashboard`

### 👤 User Management
- `GET /api/users`  
- `POST /api/users`

### 🛏️ Room/Card Setup
- `GET /api/manage_tables`  
- `POST /api/manage_tables`

### 🚪 Guest Registration
- `POST /api/register_guest`  
- `GET /api/guests`  
- `PUT /api/guests/<id>`  
- `DELETE /api/guests/<id>`

### 💬 Help Desk
- `GET /api/help-messages`  
- `POST /api/help-messages`  

---

### Local Setup Guide

## 📁 Project Structure

The project is organized into two main parts:

rfid-admin-project/ ├── backend/ └── frontend/


---

## 🔧 Step 1: Backend Setup

### Prerequisites

- Python 3.6 or higher  
- PostgreSQL database server  
- Pip (Python package manager)  

### Database Configuration

1. **Install PostgreSQL** (if not already installed)  
2. **Create a new PostgreSQL database**:
   - **Database Name**: `accessdb`
   - **Username**: `postgres`
   - **Password**: `postgres`
   - **Port**: `5432`

### Running the Backend

```bash
# Navigate to the backend directory
cd rfid-admin-project/backend

# Install required Python packages
pip install Flask psycopg2-binary flask-cors Werkzeug

# Run the Flask application
python app.py

```

✅ The backend server will start at: https://rfid.zenvinnovations.com/backend


### 💻 Step 2: Frontend Setup

### Prerequisites
- Node.js and npm (Node Package Manager)

### Running the Frontend

```bash

# Navigate to the frontend directory
cd rfid-admin-project/frontend

# Install dependencies (only needed once)
npm install

# Start the frontend development server
npm start

```

✅ The frontend will be available at: http://localhost:3000



