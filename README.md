# QATTAH — Bill Splitting App

> Split bills with friends, effortlessly.

A full-stack mobile-first web application for managing shared expenses between friends and groups.

---

## Tech Stack

| Layer    | Technology               |
|----------|--------------------------|
| Frontend | HTML5 · CSS3 · Vanilla JS |
| Backend  | PHP 8.x (REST API)       |
| Database | MySQL 5.7+               |
| Charts   | Chart.js 4               |
| Server   | XAMPP / WAMP / Apache    |

---

## Features

- **Receipt → QR Split** — Scan/upload a receipt, confirm items in a popup, generate a share link + QR; friends sign in, pick what they ordered, see a live total, and pay their share
- **Authentication** — Register, login, logout, session-based security
- **Dashboard** — Net balance, who owes you, who you owe, recent bills
- **Bills** — Add bills with equal or custom splits, upload receipts, settle debts
- **Groups** — Create groups, manage members, track group expenses
- **Analytics** — Monthly spending chart, category breakdown, top expenses
- **Notifications** — Real-time alerts when added to bills or groups
- **Payment History** — Full log of all settlements
- **Dark / Light Mode** — Persisted per user
- **Arabic / English** — RTL and LTR support

---

## Quick Start (XAMPP)

### 1. Install XAMPP
Download from [apachefriends.org](https://www.apachefriends.org) and install.

### 2. Copy project files
```
C:\xampp\htdocs\qattah\
```
Place the entire `Qattah` folder there.

### 3. Import the database
1. Open **phpMyAdmin** → `http://localhost/phpmyadmin`
2. Click **New** → create database named `qattah_db`
3. Select `qattah_db` → click **Import**
4. Choose `database.sql` → click **Go**
5. Import again, this time choosing `database_receipts.sql` (adds the
   receipt-sharing tables — safe to run on an existing DB, only adds tables)

### 4. Configure database credentials
Edit `api/config/database.php`:
```php
private string $host     = 'localhost';
private string $dbname   = 'qattah_db';
private string $username = 'root';
private string $password = '';   // your MySQL password
```

### 5. Create the uploads folder
```
C:\xampp\htdocs\qattah\uploads\receipts\
```
Or it will be created automatically on first upload.

### 6. Open the app
```
http://localhost/qattah/login.html
```

---

## Quick Start (WAMP)

Same steps, but copy to:
```
C:\wamp64\www\qattah\
```
And open:
```
http://localhost/qattah/login.html
```

---

## Demo Accounts

| Name           | Email              | Password    |
|----------------|--------------------|-------------|
| Ahmed Al-Rashid | ahmed@qattah.com  | password123 |
| Sara Mohammed   | sara@qattah.com   | password123 |
| Khalid Ibrahim  | khalid@qattah.com | password123 |
| Nora Abdullah   | nora@qattah.com   | password123 |

---

## Project Structure

```
qattah/
├── index.html            ← Main SPA (dashboard, bills, groups, profile)
├── login.html            ← Login page
├── register.html         ← Registration page
├── database.sql          ← MySQL schema + sample data
│
├── api/
│   ├── config/
│   │   ├── database.php  ← PDO connection singleton
│   │   └── response.php  ← JSON response helpers + auth guard
│   ├── auth/
│   │   ├── login.php     ← POST  /api/auth/login.php
│   │   ├── register.php  ← POST  /api/auth/register.php
│   │   ├── logout.php    ← POST  /api/auth/logout.php
│   │   └── me.php        ← GET   /api/auth/me.php
│   │                        PUT   /api/auth/me.php  (update profile)
│   ├── bills/
│   │   ├── index.php     ← GET   /api/bills/index.php  (list)
│   │   │                   POST  /api/bills/index.php  (create)
│   │   ├── show.php      ← GET   /api/bills/show.php?id=X
│   │   │                   PUT   (update)  DELETE (remove)
│   │   └── settle.php    ← POST  /api/bills/settle.php
│   ├── groups/
│   │   ├── index.php     ← GET / POST
│   │   ├── show.php      ← GET / PUT / DELETE  ?id=X
│   │   └── members.php   ← POST / DELETE  ?group_id=X
│   ├── payments/
│   │   └── index.php     ← GET / POST
│   ├── notifications/
│   │   └── index.php     ← GET / PUT (mark read)
│   ├── dashboard/
│   │   └── index.php     ← GET (aggregated data)
│   ├── analytics/
│   │   └── index.php     ← GET (charts data)
│   ├── categories/
│   │   └── index.php     ← GET
│   ├── users/
│   │   └── search.php    ← GET ?q=…
│   └── upload/
│       └── receipt.php   ← POST (multipart)
│
├── assets/
│   ├── css/
│   │   └── style.css     ← Complete responsive stylesheet
│   └── js/
│       ├── api.js         ← Fetch wrapper / API client
│       ├── app.js         ← Router, state, utilities
│       ├── dashboard.js   ← Dashboard page
│       ├── bills.js       ← Bills list, add/edit, detail
│       ├── groups.js      ← Groups list, detail, members
│       ├── profile.js     ← Profile, settings, payments history
│       └── analytics.js   ← Charts (Chart.js)
│
└── uploads/
    ├── .htaccess          ← Prevents PHP execution in uploads
    └── receipts/          ← Uploaded receipt images
```

---

## Database Schema

```
users ──────────────────────────────────┐
  id, name, email, password, avatar,    │
  phone, bio, language, theme           │
                                        │
groups ─────────────────────────────────┤
  id, name, description, created_by ───>┤ (FK → users)
                                        │
group_members                           │
  id, group_id → groups, user_id ──────>┘
  role (admin|member)
                                        
bills ──────────────────────────────────
  id, title, amount, currency,
  category_id → categories,
  group_id → groups,
  paid_by → users,
  split_type, receipt_image, bill_date

bill_participants
  id, bill_id → bills, user_id → users
  amount_owed, is_settled, settled_at

payments
  id, from_user → users, to_user → users
  bill_id → bills, amount, note

notifications
  id, user_id → users, type, title,
  message, reference_id, is_read

categories  (seeded — 10 default categories)
  id, name_en, name_ar, icon, color
```

---

## API Reference

### Auth
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/login.php` | Login |
| POST | `/api/auth/register.php` | Register |
| POST | `/api/auth/logout.php` | Logout |
| GET  | `/api/auth/me.php` | Current user |
| PUT  | `/api/auth/me.php` | Update profile / password |

### Bills
| Method | URL | Description |
|--------|-----|-------------|
| GET  | `/api/bills/index.php` | List bills (supports `?q=&category_id=&page=`) |
| POST | `/api/bills/index.php` | Create bill |
| GET  | `/api/bills/show.php?id=X` | Bill detail with participants |
| PUT  | `/api/bills/show.php?id=X` | Update bill |
| DELETE | `/api/bills/show.php?id=X` | Delete bill |
| POST | `/api/bills/settle.php` | Mark participant share as settled |

### Groups
| Method | URL | Description |
|--------|-----|-------------|
| GET  | `/api/groups/index.php` | My groups |
| POST | `/api/groups/index.php` | Create group |
| GET  | `/api/groups/show.php?id=X` | Group detail |
| PUT  | `/api/groups/show.php?id=X` | Edit group |
| DELETE | `/api/groups/show.php?id=X` | Delete group |
| POST | `/api/groups/members.php?group_id=X` | Add member |
| DELETE | `/api/groups/members.php?group_id=X` | Remove member |

---

## Security Measures

- **SQL Injection** — All queries use PDO prepared statements
- **XSS** — All output escaped with `htmlspecialchars()`
- **CSRF** — Session cookie limited to `localhost` via `Access-Control-Allow-Origin`
- **File Uploads** — MIME type verified via `finfo`, extension whitelist, 5 MB limit
- **PHP execution in uploads** — Blocked via `.htaccess`
- **Password storage** — `password_hash()` with `PASSWORD_BCRYPT`
- **Session fixation** — `session_regenerate_id(true)` on login
- **Auth guard** — Every API endpoint calls `requireAuth()` before processing

---

## Branding

| Element | Value |
|---------|-------|
| App Name | QATTAH (قطّة) |
| Primary colour | Emerald `#10B981` |
| Secondary colour | Dark Gray `#1F2937` |
| Accent colour | Gold `#F59E0B` |
| Font | System UI (platform native) |

---

## Browser Support

Chrome 90+, Safari 14+, Firefox 88+, Edge 90+, Samsung Internet 14+

---

## License

MIT — free for personal and commercial use.
