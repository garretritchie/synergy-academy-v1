# Synergy Academy email delivery

Application email is delivered through the SMTP2GO HTTP API from Supabase Edge Functions. The API key must remain a server-side secret named `SMTP2GO_API_KEY`; never expose it through a `VITE_` variable or commit it to Git.

## Deployment order

1. Apply `20260819193000_014_email_delivery_and_manual_users.sql`.
2. Configure the Edge Function secret `SMTP2GO_API_KEY` in the Bolt Supabase project.
3. Deploy `admin-create-user`, `academy-email`, and `request-password-reset`.
4. Keep **Settings → Email delivery kill switch** disabled while testing the interface.
5. Verify the SMTP2GO sender address or domain, then enable delivery deliberately.

## Supported email paths

- Manual account welcome notices. Temporary passwords are never emailed.
- Optional seven-day self-registration invitations.
- Cohort announcements.
- Live-class reminders.
- Assignment reminders.
- Password-reset links generated server-side through Supabase Auth.

Every attempted delivery is recorded in `email_outbox` as sent, failed, or suppressed. When the kill switch is off, Edge Functions do not contact SMTP2GO.

## CLI deployment

After authenticating and linking the Supabase CLI:

```powershell
npx supabase db push
npx supabase functions deploy admin-create-user
npx supabase functions deploy academy-email
npx supabase functions deploy request-password-reset --no-verify-jwt
```

The current local checkout must be linked with `npx supabase link --project-ref <project-ref>` and authenticated with `npx supabase login` before these commands can run.
