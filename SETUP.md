# TINYTHREADS Setup

## 1) Environment Variables
Create `.env` from `.env.example` and fill all keys.

## 2) Supabase SQL
Run `supabase-schema.sql` in Supabase SQL Editor.

## 3) Create Admin User
Sign up using the app once, then run this SQL in Supabase:

```sql
update public.user_profiles
set role = 'admin'
where id = 'YOUR_AUTH_USER_UUID';
```

To find your user UUID:

```sql
select id, email from auth.users order by created_at desc;
```

## 4) Install and Run

```bash
npm install
npm start
```

Open `http://localhost:3000` for store and `http://localhost:3000/admin` for admin panel.
