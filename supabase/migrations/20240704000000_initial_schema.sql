-- Initial schema snapshot for Twinmind Supabase project.
-- This file is maintained manually until Supabase CLI exports are available in CI.

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_profile_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  meta jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_actor_profile_id_fkey FOREIGN KEY (actor_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.briefs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  answers jsonb NOT NULL,
  completed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT briefs_pkey PRIMARY KEY (id),
  CONSTRAINT briefs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.client_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  role text DEFAULT 'client'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_members_pkey PRIMARY KEY (id),
  CONSTRAINT client_members_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT client_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  notes text,
  account_status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  author_profile_id uuid NOT NULL,
  body text NOT NULL,
  visibility USER-DEFINED NOT NULL DEFAULT 'both'::visibility_enum,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT comments_author_profile_id_fkey FOREIGN KEY (author_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  profile_id uuid,
  first_name text,
  last_name text,
  email text NOT NULL,
  phone text,
  title text,
  is_primary boolean DEFAULT false,
  gdpr_consent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT contacts_pkey PRIMARY KEY (id),
  CONSTRAINT contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT contacts_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  uploaded_by_profile_id uuid NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  size integer,
  mime text,
  visibility USER-DEFINED NOT NULL DEFAULT 'both'::visibility_enum,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT files_pkey PRIMARY KEY (id),
  CONSTRAINT files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT files_uploaded_by_profile_id_fkey FOREIGN KEY (uploaded_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.invites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  accepted_profile_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invites_pkey PRIMARY KEY (id),
  CONSTRAINT invites_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT invites_accepted_profile_id_fkey FOREIGN KEY (accepted_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'Quote'::invoice_status,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EUR'::text,
  issued_at timestamp with time zone DEFAULT now(),
  due_at timestamp with time zone,
  paid_at timestamp with time zone,
  external_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (id),
  CONSTRAINT invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.pipeline_order (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pipeline_column USER-DEFINED NOT NULL UNIQUE,
  order_ids ARRAY NOT NULL DEFAULT '{}'::uuid[],
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT pipeline_order_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role USER-DEFINED NOT NULL,
  full_name text,
  company text,
  email text,
  phone text,
  timezone text,
  gdpr_consent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.project_stage_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  from_status USER-DEFINED,
  to_status USER-DEFINED NOT NULL,
  changed_by_profile_id uuid,
  changed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_stage_events_pkey PRIMARY KEY (id),
  CONSTRAINT project_stage_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_stage_events_changed_by_profile_id_fkey FOREIGN KEY (changed_by_profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status USER-DEFINED NOT NULL DEFAULT 'Backlog'::project_status,
  priority USER-DEFINED DEFAULT 'medium'::priority_enum,
  value_quote numeric,
  value_invoiced numeric,
  value_paid numeric,
  due_date date,
  assignee_profile_id uuid,
  labels ARRAY,
  tags ARRAY,
  archived boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT projects_assignee_profile_id_fkey FOREIGN KEY (assignee_profile_id) REFERENCES public.profiles(id)
);
