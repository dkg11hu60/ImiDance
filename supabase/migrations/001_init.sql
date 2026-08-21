-- Create profiles table with unique name constraint
create table if not exists profiles (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  gender text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table profiles enable row level security;

-- Allow public read access
create policy "Allow public read access" on profiles
  for select using (true);

-- Allow public insert access
create policy "Allow public insert access" on profiles
  for insert with check (true);