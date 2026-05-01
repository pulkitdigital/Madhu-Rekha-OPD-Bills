# Madhurekha Eye Care Centre — OPD Billing System

A clean, fast, and print-ready OPD billing dashboard built with **React (Vite)**, **Tailwind CSS**, and **Firebase Firestore**.

---

## Features

- **Manual receipt numbering** — no auto-increment, enter any number you want
- **Live receipt preview** — mirrors real physical receipt layout (A5 landscape)
- **Save & Print** — one-click save to Firestore + browser print
- **All Bills** — searchable, filterable table with delete
- **Payment History** — cash/UPI/bank breakdown with date filter + visual bar
- **Dashboard** — today's summary + all-time totals at a glance

---

## Project Structure

```
clinic-opd-billing/
├── public/
├── src/
│   ├── firebase/
│   │   └── config.js          ← Firebase init (edit this first)
│   ├── components/
│   │   ├── Layout.jsx          ← Sidebar + page wrapper
│   │   ├── Sidebar.jsx         ← Navigation sidebar
│   │   └── ReceiptPreview.jsx  ← Live receipt (matches real format)
│   ├── pages/
│   │   ├── Dashboard.jsx       ← Overview stats
│   │   ├── NewBill.jsx         ← Main billing form
│   │   ├── AllBills.jsx        ← Bills table with search/filter
│   │   └── PaymentHistory.jsx  ← Payment mode breakdown
│   ├── utils/
│   │   └── amountToWords.js    ← Number → Indian words converter
│   ├── App.jsx                 ← Routes
│   ├── main.jsx                ← Entry point
│   └── index.css               ← Tailwind + print styles
├── .env.example                ← Copy to .env and fill values
├── firestore.rules             ← Firestore security rules
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── README.md
```

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Firebase

#### Step A — Create a Firebase project
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, follow the wizard
3. In the sidebar, click **Firestore Database → Create database**
4. Choose **Start in test mode** for now (you can add rules later)
5. Go to **Project Settings → General → Your apps → Add app → Web**
6. Register the app and **copy the config object**

#### Step B — Add your config
Open `src/firebase/config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

*Or use environment variables (recommended):*
```bash
cp .env.example .env
# Edit .env with your values, then uncomment the env section in config.js
```

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Firestore Collection Structure

**Collection name:** `receipts`

| Field | Type | Description |
|---|---|---|
| `receiptNo` | string | Manually entered receipt number |
| `date` | string | Date in `YYYY-MM-DD` format |
| `name` | string | Patient name |
| `address` | string | Patient address |
| `amount` | number | Amount paid |
| `amountWords` | string | Amount in words (auto-generated) |
| `purpose` | string | Purpose of payment (default: Consultancy Fees) |
| `operation` | string | Operation/Procedure (optional) |
| `paymentMode` | string | Cash / UPI / Bank Transfer |
| `createdAt` | timestamp | Server timestamp (auto) |

---

## Printing

1. Fill in the form on the **New OPD Bill** page
2. Click **Save & Print**
3. The browser print dialog opens — the receipt preview prints exactly on **A5 landscape** paper
4. Only the receipt area is printed (sidebar, form, buttons are hidden)

**Print settings in browser:**
- Paper size: A5
- Orientation: Landscape
- Margins: None (or Minimum)
- Uncheck "Headers and footers"

---

## Firestore Security Rules

The included `firestore.rules` file uses open access for development.
Before deploying to production, restrict access:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /receipts/{docId} {
      // Example: only authenticated users
      allow read, write: if request.auth != null;
    }
  }
}
```

Deploy rules via Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

---

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Deploy to Firebase Hosting, Vercel, Netlify, etc.

---

## Customization

| What to change | Where |
|---|---|
| Clinic name, address, doctors | `src/components/ReceiptPreview.jsx` (header section) |
| Default purpose text | `src/pages/NewBill.jsx` → `defaultForm.purpose` |
| Payment mode options | `src/pages/NewBill.jsx` → `<select>` options |
| Print paper size | `src/index.css` → `@page { size: ... }` |
| Sidebar nav items | `src/components/Sidebar.jsx` → `navItems` array |

---

## Tech Stack

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- [Tailwind CSS 3](https://tailwindcss.com/)
- [Firebase 10 (Firestore)](https://firebase.google.com/docs/firestore)
- [React Router 6](https://reactrouter.com/)
