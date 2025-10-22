-- Adds cancellation metadata fields to subscriptions for Stripe webhook processing.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS canceled_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean,
  ADD COLUMN IF NOT EXISTS cancellation_details jsonb;
