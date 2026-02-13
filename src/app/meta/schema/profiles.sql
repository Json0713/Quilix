--------------- Create profiles table ---------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('personal', 'team')),
  phone text,
  created_at timestamptz default now()
);

-------------- Enable Row Level Security -------------

alter table public.profiles enable row level security;

---------------------- Policies ----------------------

-- Read own profile
create policy "read own profile"
on public.profiles
for select
using (auth.uid() = id);

-- Insert own profile
create policy "insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

-- Update own profile
create policy "update own profile"
on public.profiles
for update
using (auth.uid() = id);

-- Delete own profile
create policy "delete own profile"
on public.profiles
for delete
using (auth.uid() = id);

----------- Trigger to auto-create profile on signup -----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (
    id,
    username,
    role,
    phone,
    created_at
  )
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    coalesce(new.raw_user_meta_data->>'role', 'personal'),
    new.raw_user_meta_data->>'phone',
    now()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
