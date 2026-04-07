-- ═══════════════════════════════════════════════════════════
-- SpendBook – Supabase Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  photo_url    TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PAYMENT METHODS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_key         TEXT NOT NULL,
  bank_name        TEXT NOT NULL,
  bank_is_custom   BOOLEAN NOT NULL DEFAULT FALSE,
  payment_type     TEXT NOT NULL CHECK (payment_type IN ('UPI','Debit','Credit','Net Banking')),
  upi_app          TEXT,
  upi_app_is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  upi_app_name     TEXT,
  last_four_digits TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── BOOKS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.books (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color_tag   TEXT NOT NULL DEFAULT '#5c2d91',
  icon_emoji  TEXT NOT NULL DEFAULT '📒',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
  share_id    UUID UNIQUE
);

-- ── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id               UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  owner_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL CHECK (type IN ('in','out','transfer')),
  amount                NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  category              TEXT NOT NULL,
  payment_method_id     UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  to_payment_method_id  UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  person                TEXT NOT NULL DEFAULT '',
  note                  TEXT NOT NULL DEFAULT '',
  date                  DATE NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── IF UPGRADING AN EXISTING DATABASE ────────────────────────
-- Run these ALTER statements if the table already exists:
-- ALTER TABLE public.transactions
--   ADD COLUMN IF NOT EXISTS to_payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
--   ADD COLUMN IF NOT EXISTS person TEXT NOT NULL DEFAULT '';
-- ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
-- ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('in','out','transfer'));

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payment_methods_owner ON public.payment_methods(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_owner ON public.books(owner_id);
CREATE INDEX IF NOT EXISTS idx_books_share_id ON public.books(share_id) WHERE share_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_book ON public.transactions(book_id);
CREATE INDEX IF NOT EXISTS idx_transactions_owner ON public.transactions(owner_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "users: select own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users: insert own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users: update own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Users: allow reading owner info for shared books (needed by shared view)
CREATE POLICY "users: select for shared" ON public.users FOR SELECT
  USING (
    id IN (
      SELECT owner_id FROM public.books
      WHERE is_shared = TRUE AND share_id IS NOT NULL
    )
  );

-- Payment Methods: owner only
CREATE POLICY "pm: select own" ON public.payment_methods FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "pm: insert own" ON public.payment_methods FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pm: delete own" ON public.payment_methods FOR DELETE USING (auth.uid() = owner_id);

-- Books: owner full access
CREATE POLICY "books: select own" ON public.books FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "books: insert own" ON public.books FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "books: update own" ON public.books FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "books: delete own" ON public.books FOR DELETE USING (auth.uid() = owner_id);

-- Books: anyone can read shared books (no auth needed for shared view)
CREATE POLICY "books: select shared" ON public.books FOR SELECT
  USING (is_shared = TRUE AND share_id IS NOT NULL);

-- Transactions: owner full access
CREATE POLICY "txn: select own" ON public.transactions FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "txn: insert own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "txn: update own" ON public.transactions FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "txn: delete own" ON public.transactions FOR DELETE USING (auth.uid() = owner_id);

-- Transactions: anyone can read transactions for shared books
CREATE POLICY "txn: select shared" ON public.transactions FOR SELECT
  USING (
    book_id IN (
      SELECT id FROM public.books
      WHERE is_shared = TRUE AND share_id IS NOT NULL
    )
  );

-- ── REALTIME ─────────────────────────────────────────────────
-- Enable Realtime for all tables (do this in Supabase Dashboard → Database → Replication)
-- Or run:
ALTER PUBLICATION supabase_realtime ADD TABLE public.books;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_methods;
