# 🏛️ RU Lost & Found

![Project Status](https://img.shields.io/badge/Status-Completed-success)
![Tech Stack](https://img.shields.io/badge/Stack-MERN-blue)
![License](https://img.shields.io/badge/License-MIT-green)

A comprehensive, full-stack Lost & Found portal custom-built for **Rishihood University**. This platform connects lost items with their owners within the university community through a secure, feature-rich, and visually stunning web application.

---

## 📝 Project Overview

**RU Lost & Found** is a robust web application built for students to report, search, and claim lost or found items on campus. The platform facilitates secure, privacy-respecting communication between students via automated email notifications, with built-in identity verification through OTP-based email validation.

---

## ✨ Key Features & Workflows

### 🔐 Enterprise-Grade Security
* **OTP-Verified Registration:** Users must verify their email addresses via a 6-digit OTP before they can create an account. OTPs are stored securely in-memory and auto-clean.
* **Password Recovery:** Secure "Forgot Password" flow with timed, single-use OTPs stored in MongoDB.
* **JWT Authentication:** Stateful user sessions protected by secure HTTP bearer tokens (5-hour expiry).
* **Encrypted Passwords:** Passwords securely hashed using `bcryptjs`.

### 📦 Core Functionality
* **Mandatory Image Reporting:** Custom HTML5 drag-and-drop file upload zone (powered by Multer) ensures all items are verifiable with a photo. Image preview and client-side validation (5MB max) included.
* **Real-time Search & Filter:** Lightning-fast, client-side search across item titles, descriptions, and locations. Works dynamically with category tabs (All, Lost, Found, Claimed).
* **Automated Email Notifications:** "Claiming" an item triggers an atomic transaction that sends a professionally formatted HTML email to the reporter, facilitating connection without exposing private phone numbers unless authorized.
* **Editable Profiles:** Full CRUD profile management via a dropdown card. Users can update their name, year, school, phone number, and profile picture.

### 🎨 Premium UI/UX Design
* **Glassmorphism Aesthetic:** Frosted glass headers and modals (`backdrop-blur`) layered over high-quality campus imagery.
* **Modern Typography:** High-end font pairing using Google Fonts (`Playfair Display` for editorial headings, `Inter` for crisp body text).
* **Micro-interactions:** Staggered scroll animations (Intersection Observer), smooth hover lifts, floating action buttons, and glowing borders.
* **Consistent Layouts:** Flexbox-driven card dimensions ensure pixel-perfect alignment across all devices regardless of content length.

---

## 🛠️ Technology Stack (MERN)

### Frontend
| Technology | Purpose |
|---|---|
| **React 18 + TypeScript** | UI framework, built with Vite |
| **Tailwind CSS** | Utility-first responsive styling |
| **lucide-react** | SVG icon library |
| **React Context API** | Global auth state management (`AuthContext.tsx`) |
| **react-router-dom** | Client-side routing |

### Backend
| Technology | Purpose |
|---|---|
| **Node.js + Express.js** | REST API server |
| **MongoDB + Mongoose** | Database and ODM |
| **JWT + bcryptjs** | Authentication and security |
| **multer** | Multipart file upload handling (images) |
| **nodemailer** | Automated transactional emails |

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v16+)
* MongoDB (Local instance or MongoDB Atlas cluster)
* A Gmail account with an "App Password" generated for Nodemailer

### 1. Clone the repository
```bash
git clone https://github.com/your-username/ru-lost-and-found.git
cd ru-lost-and-found
```

### 2. Environment Variables
Create a `.env` file in the `backend/` directory:

```env
# Backend Server Port (using 5001 to avoid macOS AirPlay conflicts)
PORT=5001

# MongoDB Connection String
MONGODB_URI=mongodb://127.0.0.1:27017/ru-lost-found

# Security
JWT_SECRET=your_super_secret_jwt_key_here

# Email Configuration (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
```

### 3. Install Dependencies & Run

You will need two terminal windows to run both servers concurrently.

**Terminal 1 (Backend):**
```bash
cd backend
npm install
node server.js
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
```

The application will be accessible at `http://localhost:5173`. 
*(Note: Vite proxy is configured to automatically route `/api/*` requests to your backend at `http://127.0.0.1:5001`).*

---

## ⚡ Performance & Deployment Architecture

To ensure a production-ready, lightning-fast experience on free-tier hosting, several specific architectural optimizations were implemented:

* **Cloudinary Media Pipeline:** Bypassed ephemeral serverless storage limitations by integrating `multer-storage-cloudinary`. All user uploads are streamed directly to Cloudinary's global CDN, ensuring permanent image persistence.
* **Separation of Concerns:** Deployed the static React/Vite frontend to **Vercel** for edge-network delivery, while the stateful Node/Express API is hosted on **Render**.
* **Zero-Latency Cold Starts (The Cron Hack):** Free-tier Render backends typically sleep after 15 minutes of inactivity, causing 30+ second delays for the next user. This was solved by engineering a dedicated, database-free `/api/ping` endpoint. An external service ([cron-job.org](https://cron-job.org/)) pings this endpoint every 10 minutes, keeping the server perpetually awake without consuming MongoDB read quotas.
* **Graceful Degradation:** Implemented a custom animated loading state in `Dashboard.tsx` that informs users ("Waking up the server...") in the rare event a cold start does occur.

---

## 📂 Detailed Directory Structure

```text
RU Lost & Found/
├── backend/
│   ├── controllers/
│   │   ├── authController.js      # Register, Login, Passwords, OTPs, Profile
│   │   ├── contactController.js   # Claim workflow & Email dispatch
│   │   └── itemController.js      # CRUD for items with image uploads
│   ├── middleware/
│   │   ├── auth.js                # JWT verification
│   │   └── upload.js              # Multer configuration (crypto filenames)
│   ├── models/
│   │   ├── User.js                # User schema (12 fields)
│   │   └── Item.js                # Item schema with claimedBy subdoc
│   ├── routes/                    # API route definitions
│   ├── uploads/                   # Stored images (Express static serving)
│   ├── server.js                  # Entry point
│   └── package.json               
│
└── frontend/
    ├── public/
    │   ├── rishihood-logo.png     # University branding
    │   ├── ru-symbol.png          # Favicon & Header logo
    │   └── campus-illustration.png# Footer aesthetic
    ├── src/
    │   ├── components/
    │   │   ├── Login.tsx           # 4-mode auth logic & UI
    │   │   ├── Dashboard.tsx       # Main feed, filters, pagination
    │   │   ├── Header.tsx          # Glassmorphism navbar & search
    │   │   ├── ProfileCard.tsx     # Editable dropdown profile
    │   │   ├── ItemCard.tsx        # Item display with hover effects
    │   │   ├── ClaimModal.tsx      # Atomic claim workflow UI
    │   │   ├── ReportForm.tsx      # Drag & Drop upload form
    │   │   ├── Footer.tsx          # Illustrated footer
    │   │   └── PrivateRoute.tsx    # Route guard
    │   ├── contexts/
    │   │   └── AuthContext.tsx     # Global JWT state management
    │   ├── services/
    │   │   └── itemService.ts      # API wrappers (fetch API)
    │   ├── types.ts                # TypeScript interfaces
    │   ├── App.tsx                 # Root Router
    │   └── index.css               # Tailwind directives & Animations
    ├── tailwind.config.js          # Custom theme colors & radii
    └── vite.config.ts              # Proxy configuration
```

---

## 🗄️ Database Schemas

### User Schema
* `email`, `password` (hashed)
* `firstName`, `lastName`, `year`, `school`, `enrollmentNumber`
* `phone`, `profilePicture` (optional)
* `resetOtp`, `resetOtpExpiry` (temporary)

### Item Schema
* `type` ('lost' or 'found')
* `title`, `description`, `location`, `date`
* `reporter`, `reporterId` (ref: User)
* `status` ('open' or 'claimed')
* `image` (URL to `/uploads/`)
* `claimedBy` (Object: name, contact, details)

---

## 🔌 API Endpoints Reference

### Auth (`/api/auth`)
* `POST /send-signup-otp` - Dispatch verification email
* `POST /register` - Create account (Multer `profilePicture`)
* `POST /login` - Issue JWT
* `POST /forgot-password` - Dispatch reset OTP
* `POST /reset-password` - Update password
* `GET /me` - Fetch profile
* `PUT /me` - Update profile fields (Multer `profilePicture`)

### Items (`/api/items`)
* `GET /` - Fetch all items (populated)
* `POST /` - Create item (Multer `image` mandatory)
* `PATCH /:id/status` - Mark claimed
* `DELETE /:id` - Delete item (Owner only)

### Contact (`/api/contact`)
* `POST /:itemId` - Send claim email & trigger item status update

---

## 👤 Author

**Prashant Kumar**  
Rishihood University  
📧 [prashant.k23csai@nst.rishihood.edu.in](mailto:prashant.k23csai@nst.rishihood.edu.in)

---
*Created with ❤️ for the Rishihood University Community.*