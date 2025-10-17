-- Adds extended contact fields directly on the clients table.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS timezone text;
