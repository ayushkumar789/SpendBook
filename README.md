# 📒 SpendBook

> **Track every rupee, every day.**

SpendBook is a full-featured personal finance tracking app built with React Native (Expo) and Supabase. Track your income and expenses across multiple books, share books with family in real-time, visualize spending with charts, and manage all your payment methods in one place.

---

## 📱 Screenshots

> Login • Home • Add Transaction • Payment Methods • Settings

---

## ✨ Features

- 🔐 **Google OAuth Login** — Secure sign-in via Supabase PKCE flow
- 📚 **Multiple Expense Books** — Create and manage separate books for different purposes
- 💸 **Cash In / Cash Out / Self Transfer** — Track all types of transactions
- 👤 **Contact Picker** — Select contacts from your phone for paid to/received from
- 💳 **Payment Methods** — Track UPI, debit/credit cards, net banking, and more
- 📊 **Charts & Insights** — Spending bar charts and category pie charts
- 🔁 **Real-time Sync** — Live updates via Supabase Realtime subscriptions
- 🤝 **Book Sharing** — Share books via UUID share code for read-only access
- 📅 **Custom Calendar Picker** — Beautiful native-style date selection
- 🇮🇳 **Indian Rupee (₹)** — Built specifically for Indian users

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 54 |
| Navigation | Expo Router v6 |
| Backend | Supabase (PostgreSQL + Realtime + Auth) |
| Authentication | Google OAuth via Supabase PKCE |
| Styling | NativeWind (Tailwind CSS for RN) |
| Charts | Custom View-based (no react-native-reanimated) |
| Storage | Supabase Row Level Security |
| Build | EAS Build + EAS Update |
| Language | TypeScript |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI
- A Supabase account
- A Google Cloud Console project

### 1. Clone the Repository

```bash
git clone https://github.com/ayushkumar789/spendbook.git
cd spendbook
```

### 2. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Enable Google Auth: **Authentication → Providers → Google**
4. Add redirect URL: `spendbook://auth/callback` under **Auth → URL Configuration**
5. Enable Realtime on `books`, `transactions`, and `payment_methods` tables

### 4. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web + Android)
3. Add Supabase callback URL to authorized redirect URIs:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```

### 5. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_android_client_id
```

### 6. Generate App Assets

```bash
node scripts/generate-assets.js
```

### 7. Start Development Server

```bash
npx expo start --clear --dev-client
```

---

## 🏗️ Building the App

### Development Build (with Metro server)

```bash
eas build --profile development --platform android
```

### Preview Build (standalone, no server needed)

```bash
eas build --profile preview --platform android
```

### Push OTA Updates

```bash
eas update --branch preview --message "your update message"
```

---

## 📁 Project Structure

```
SpendBook/
├── app/                        # Expo Router screens
│   ├── (tabs)/                 # Bottom tab screens
│   │   ├── index.tsx           # Home screen
│   │   ├── payments.tsx        # Payment methods
│   │   └── settings.tsx        # Settings & profile
│   ├── auth/
│   │   └── callback.tsx        # OAuth callback handler
│   ├── book/                   # Book screens
│   ├── transaction/            # Transaction screens
│   ├── payment-method/         # Payment method screens
│   └── shared/                 # Shared book view
├── components/                 # Reusable UI components
│   ├── ui/
│   │   ├── FAB.tsx             # Floating action button
│   │   ├── BottomSheet.tsx     # Animated bottom sheet
│   │   ├── LoadingSpinner.tsx
│   │   └── EmptyState.tsx
│   └── charts/
│       ├── SpendingBarChart.tsx
│       └── CategoryPieChart.tsx
├── hooks/                      # Custom React hooks
│   ├── useAuth.ts
│   ├── useBooks.ts
│   ├── useTransactions.ts
│   └── usePaymentMethods.ts
├── lib/
│   ├── supabase.ts             # Supabase client + CRUD + Realtime
│   └── format.ts               # ₹ formatting, dates
├── constants/
│   ├── colors.ts
│   ├── categories.ts
│   └── types.ts
├── scripts/
│   └── generate-assets.js      # App icon + splash generator
├── supabase/
│   └── schema.sql              # Full DB schema with RLS + indexes
└── .env.example
```

---

## 🗄️ Database Schema

| Table | Description |
|-------|-------------|
| `users` | User profiles synced from Supabase Auth |
| `books` | Expense books with share UUID |
| `transactions` | All financial transactions |
| `payment_methods` | UPI, cards, bank accounts |

All tables have **Row Level Security (RLS)** enabled. Shared books are accessible via read-only RLS policy using `share_id`.

---

## 🎨 Key Design Decisions

- **Charts** — Custom View-based bar + segmented pie charts, avoids `react-native-reanimated` entirely
- **Date Picker** — Custom calendar modal with month navigation, no native dependencies
- **Google OAuth** — Supabase PKCE flow via `expo-web-browser.openAuthSessionAsync` → `exchangeCodeForSession`
- **Sharing** — UUID stored in `books.share_id`, read-only public view via Supabase RLS
- **Self Transfer** — Third transaction type with source + destination accounts, net zero balance impact
- **Contact Picker** — `expo-contacts` integration for selecting recipients from phone contacts

---

## 🔒 Security

- All API keys are stored in environment variables
- Row Level Security (RLS) enforced on all Supabase tables
- Users can only access their own data
- Shared books are strictly read-only via RLS policy
- Google OAuth uses PKCE (Proof Key for Code Exchange)

---

## 📄 License

MIT License — feel free to use and modify for personal projects.

---

## 🙏 Acknowledgements

- [Expo](https://expo.dev) — Amazing React Native toolchain
- [Supabase](https://supabase.com) — Open source Firebase alternative
- [NativeWind](https://nativewind.dev) — Tailwind CSS for React Native

---

Built with ❤️ by [Ayush Panigrahi](https://github.com/ayushkumar789)
