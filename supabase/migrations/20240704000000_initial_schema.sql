-- Initial schema snapshot for Twinmind Supabase project.
-- This file is maintained manually until Supabase CLI exports are available in CI.

create extension if not exists "pgcrypto";

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  website text,
  account_status text not null default 'active'
);

create table if not exists public.profiles (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  role text not null,
  full_name text,
  company text,
  email text,
  phone text,
  timezone text,
  gdpr_consent boolean not null default false
);

create table if not exists public.client_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  unique (client_id, profile_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  description text not null,
  status text not null default 'Brief Gathered',
  due_date date
);

create table if not exists public.briefs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects(id) on delete cascade,
  answers jsonb not null,
  completed boolean not null default false,
  unique (project_id)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'Quote',
  amount numeric(12,2) not null,
  currency text not null default 'EUR',
  issued_at timestamptz
);

create table if not exists public.client_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_name text not null,
  client_email text not null,
  company text,
  website text,
  phone text,
  timezone text,
  budget text,
  goals text not null,
  core_features text not null,
  gdpr_consent boolean not null default false,
  project_name text not null,
  project_description text not null,
  project_due_date date,
  integrations text,
  timeline text,
  success_metrics text,
  target_users text not null,
  competitors jsonb default '[]'::jsonb,
  risks text,
  invite_client boolean not null default false
);

select pg_notify('pgrst', 'reload schema');
