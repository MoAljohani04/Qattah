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

- **Receipt → QR Split** — Every split starts with an AI scan: photograph the
  receipt, the model reads the line items, you confirm or correct them in a
  popup, then share a link + QR. Friends sign in, pick what they ordered, see a
  live total, and pay their share
- **Shareable items** — Tick an item in the confirm dialog and it is split
  evenly between everyone who picks it (mezze, a big pizza, a pitcher) instead
  of being claimed unit by unit. The AI pre-ticks the obvious ones
- **Group scans** — Scan straight into a group; every member is notified and
  the receipt is listed on the group page
- **Sign in with Google** — One tap and you're in, with nothing to type. A
  returning visitor is signed in automatically. Google accounts are linked to
  an existing email/password account when the addresses match, so nobody ends
  up with two profiles. Sessions last 30 days, so signing in is rare
- **Authentication** — Register, login, logout, session-based security
- **Dashboard** — Net balance, who owes you, who you owe, recent bills
- **Bills** — Created from scans; equal or custom splits, editable after the fact
- **Groups** — Create groups, manage members, track group expenses
- **Analytics** — Monthly spending chart, category breakdown, top expenses
- **Notifications** — Real-time alerts when added to bills or groups
- **Payment History** — Full log of all settlements
- **Dark / Light Mode** — Persisted per user. The dark palette is warm
  charcoal rather than the usual cold navy, so the light theme's warmth
  survives the switch
- **Arabic / English** — RTL and LTR support, with Cairo standing in for the
  Latin display face so Arabic headings keep the same weight relationship

---

## Design language

The visual language is adapted from a "SplitEasy" Figma Make concept: a warm
cream ground instead of grey-white, near-black ink for primary actions, a
heavy condensed display face (Archivo Black) against a quiet body sans,
pill buttons, and hairline-bordered cards with almost no shadow.

Two deliberate departures from that reference, both documented at the top of
`assets/css/style.css`:

1. **Contrast.** Its terracotta and green reach only ~3.9:1 and ~4.2:1 on the
   cream background — fine for the giant numerals they were used for, but
   failing WCAG AA for the small pills and labels QATTAH also needs them in.
   Both are darkened here to clear 4.5:1.
2. **Coverage.** The reference covers three screens. Everything else — the
   scan flow, the confirm-items dialog, QR share, the public claim page,
   profile, analytics, admin, auth — was designed in the same language rather
   than copied, and the mobile bottom-nav architecture was kept because
   QATTAH is used standing at a restaurant table, not at a desk.

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
6. Import once more, choosing `database_update_v2.sql` (group receipts +
   shareable items — safe to re-run, it guards every change)
7. And finally `database_update_v3.sql` (Sign in with Google — also safe
   to re-run)

### 4. Turn on Sign in with Google (optional)
Skip this and the app just shows email/password sign-in — nothing breaks.

1. <https://console.cloud.google.com> → create or pick a project
2. **APIs & Services → OAuth consent screen** → External → fill in the app
   name and your email → Save
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → *Web application*
4. Under **Authorised JavaScript origins** add the origin you open the app
   from. For XAMPP that is exactly:
   ```
   http://localhost
   ```
   Origins only — no `/Qattah` path. Add the port if you use one.
5. Copy the Client ID (it ends in `.apps.googleusercontent.com`) into
   `api/config/google.php`:
   ```php
   const GOOGLE_CLIENT_ID = '1234567890-abc123.apps.googleusercontent.com';
   ```

This Client ID is *not* a secret — it is embedded in the sign-in button and
visible in the page source, so it is safe to commit. There is no client
secret in this flow at all: Google hands the browser a signed ID token and
`api/auth/google.php` verifies that signature against Google's public
certificates before trusting anything inside it.

### 5. Add your AI key
`api/config/ai.php` is gitignored so keys never reach the repo. Copy the
template and paste your own key:
```
copy api\config\ai.example.php api\config\ai.php
```
Get a free Gemini key at <https://aistudio.google.com/apikey>. Without a key
the scan still works — you just fill the items in by hand in the confirm
dialog instead of having them read for you.

### 6. Configure database credentials
Edit `api/config/database.php`:
```php
private string $host     = 'localhost';
private string $dbname   = 'qattah_db';
private string $username = 'root';
private string $password = '';   // your MySQL password
```

### 7. Create the uploads folder
```
C:\xampp\htdocs\qattah\uploads\receipts\
```
Or it will be created automatically on first upload.

### 8. Open the app
```
http://localhost/qattah/login.html
```

---

## Deploying to a real host

QATTAH is a PHP + MySQL app, so it needs a host that runs both. **Vercel,
Netlify and GitHub Pages cannot run it** — they serve static files only, so
every `api/*.php` request either 404s or is handed to the browser as raw
source text. That is not just broken, it is a credential leak: anything in
`api/config/` becomes publicly readable.

Suitable hosts: Hostinger, Namecheap, SiteGround, InfinityFree or
000webhost (free), or any cPanel shared host. All of them run Apache + PHP
+ MySQL, which is exactly what this app expects.

### Steps

1. **Upload the project** to the host's web root (`public_html`).
2. **Create a MySQL database** in the host's control panel, then import, in
   order: `database.sql`, `database_receipts.sql`, `database_admin.sql`,
   `database_update_v2.sql`, `database_update_v3.sql`.
3. **Create the two local config files** — neither is in the repo, by
   design, because they hold secrets:
   ```
   cp api/config/database.example.php api/config/database.php
   cp api/config/ai.example.php       api/config/ai.php
   ```
   Put the host's DB name, user and password in `database.php`, and your
   Gemini key in `ai.php`.
4. **Set the Google Client ID** in `api/config/google.php`, and in Google
   Cloud Console add your live origins to *Authorised JavaScript origins*:
   ```
   https://qattah.online
   https://www.qattah.online
   ```
   Both, with no trailing path. Google matches these exactly, so missing
   the `www` variant is the usual reason the button appears but sign-in
   then fails.
5. **Check `.htaccess` survived the upload.** FTP clients hide dotfiles by
   default. The root `.htaccess` forces HTTPS and refuses to serve `.php`
   as text if the PHP handler is ever missing; `api/config/.htaccess`
   blocks direct access to the config files. Without them you lose those
   protections silently.
6. **Point your domain** at the host (update the nameservers or the A
   record at your registrar), and **delete any previous Vercel/Netlify
   deployment** — otherwise it keeps serving your PHP source publicly.

### Verifying it worked

```
curl -s https://your-domain/api/auth/google.php
```
Should return JSON (`{"success":true,...}`). If it returns PHP source
starting with `<?php`, PHP is not executing and you must not leave the
site up until that is fixed.

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
| GET  | `/api/auth/google.php` | Is Google sign-in on, and with which client id |
| POST | `/api/auth/google.php` | Verify a Google ID token and sign in |

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
