-- Run this in Supabase SQL Editor
create table if not exists public.accounts (
  id bigserial primary key,
  user_id uuid not null,
  mt5_login text not null,
  mt5_server text not null,
  mt5_password_encrypted text not null,
  account_name text,
  balance double precision,
  equity double precision,
  margin double precision,
  margin_free double precision,
  profit double precision,
  currency text,
  leverage integer,
  last_synced_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (mt5_login)
);
create table if not exists public.trades (
  id bigserial primary key,
  account_id bigint not null references public.accounts(id) on delete cascade,
  deal_id text not null,
  ticket text,
  symbol text not null,
  direction text not null check (direction in ('LONG', 'SHORT')),
  volume double precision not null,
  open_price double precision not null,
  close_price double precision,
  stop_loss double precision,
  take_profit double precision,
  open_time timestamptz not null,
  close_time timestamptz,
  weekday text,
  session text check (
    session in ('ASIA', 'FRANKFURT', 'LONDON', 'NEWYORK')
  ),
  risk_percent double precision,
  risk_reward double precision,
  result text check (result in ('BE', 'SL', 'TP', 'MANUAL')),
  profit double precision default 0,
  profit_percent double precision,
  commission double precision default 0,
  swap double precision default 0,
  mistakes text,
  note text,
  trigger text,
  bias text,
  notion_page_id text,
  synced_to_notion boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (account_id, deal_id)
);
create index if not exists idx_accounts_user on public.accounts(user_id);
create index if not exists idx_trades_account on public.trades(account_id);
create index if not exists idx_trades_open_time on public.trades(open_time);
alter table public.accounts enable row level security;
alter table public.trades enable row level security;
drop policy if exists accounts_owner_policy on public.accounts;
create policy accounts_owner_policy on public.accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists trades_owner_policy on public.trades;
create policy trades_owner_policy on public.trades for all using (
  exists (
    select 1
    from public.accounts a
    where a.id = trades.account_id
      and a.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.accounts a
    where a.id = trades.account_id
      and a.user_id = auth.uid()
  )
);