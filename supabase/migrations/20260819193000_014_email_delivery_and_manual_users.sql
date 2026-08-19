/*
  # Email delivery controls and audit trail

  Application email is disabled by default. Edge Functions must call
  email_delivery_enabled() before contacting SMTP2GO.
*/

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_settings (key, value)
VALUES (
  'email_delivery',
  jsonb_build_object(
    'enabled', false,
    'from_email', 'academy@synergybahamas.com',
    'from_name', 'Synergy Academy',
    'reply_to', 'info@synergybahamas.com'
  )
)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "platform_settings_admin_read" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_read"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "platform_settings_admin_update" ON public.platform_settings;
CREATE POLICY "platform_settings_admin_update"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.email_delivery_enabled()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((value->>'enabled')::boolean, false)
  FROM public.platform_settings
  WHERE key = 'email_delivery';
$$;

REVOKE ALL ON FUNCTION public.email_delivery_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_delivery_enabled() TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type text NOT NULL,
  recipient_email text NOT NULL,
  recipient_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject text NOT NULL,
  related_table text,
  related_id uuid,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'suppressed')),
  provider_message_id text,
  error_message text,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_email_outbox_created_at
  ON public.email_outbox(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_outbox_recipient
  ON public.email_outbox(recipient_user_id, created_at DESC);

DROP POLICY IF EXISTS "email_outbox_admin_read" ON public.email_outbox;
CREATE POLICY "email_outbox_admin_read"
  ON public.email_outbox FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_email_delivery_settings(
  delivery_enabled boolean,
  sender_email text,
  sender_name text,
  reply_address text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_value jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an administrator may change email delivery settings';
  END IF;
  IF sender_email IS NULL OR position('@' IN sender_email) < 2
    OR reply_address IS NULL OR position('@' IN reply_address) < 2 THEN
    RAISE EXCEPTION 'Enter valid sender and reply-to email addresses';
  END IF;
  next_value := jsonb_build_object(
    'enabled', COALESCE(delivery_enabled, false),
    'from_email', lower(btrim(sender_email)),
    'from_name', COALESCE(NULLIF(btrim(sender_name), ''), 'Synergy Academy'),
    'reply_to', lower(btrim(reply_address))
  );
  INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
  VALUES ('email_delivery', next_value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;
  RETURN next_value;
END;
$$;

REVOKE ALL ON FUNCTION public.update_email_delivery_settings(boolean, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_email_delivery_settings(boolean, text, text, text) TO authenticated;
