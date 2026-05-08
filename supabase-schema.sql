create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, role) values (new.id, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null,
  price integer not null check (price >= 0),
  image_url text not null,
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists is_active boolean default true;
alter table public.products add column if not exists created_at timestamptz default now();
alter table public.products alter column is_active set default true;
update public.products set is_active = true where is_active is null;

create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  phone text not null,
  shipping_address text not null,
  total_amount integer not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payment_provider text not null check (payment_provider in ('cod', 'whatsapp')),
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders drop constraint if exists orders_payment_provider_check;
alter table public.orders
  add constraint orders_payment_provider_check
  check (payment_provider in ('cod', 'whatsapp'));

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete restrict;
alter table public.orders add column if not exists shipping_address text;
alter table public.orders add column if not exists total_amount integer default 0;
alter table public.orders add column if not exists status text default 'pending';
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists created_at timestamptz default now();

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  size text not null,
  unit_price integer not null check (unit_price >= 0)
);

create unique index if not exists products_name_key on public.products(name);

insert into public.products (name, description, price, image_url, stock, is_active)
values
  ('Classic White Tee', 'Soft cotton basic t-shirt for daily wear.', 899, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80', 30, true),
  ('Denim Jacket', 'Lightweight blue denim jacket with modern fit.', 2299, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=700&q=80', 15, true),
  ('Oversized Hoodie', 'Cozy fleece hoodie, perfect for cool evenings.', 1799, 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=700&q=80', 20, true),
  ('Black Cargo Pants', 'Relaxed-fit cargos with utility pockets.', 1499, 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=700&q=80', 25, true)
on conflict (name) do nothing;
