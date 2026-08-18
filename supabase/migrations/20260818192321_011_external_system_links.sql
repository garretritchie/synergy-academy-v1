/*
# External System Links — Integration Mapping Table

## Purpose
Establishes a generic integration mapping structure so Synergy Academy records can be linked to records in the external Synergy CRM / registration system without coupling the two databases. This enables future synchronization workflows where confirmed registrations create or match students, enrol them into cohorts, and issue LMS access — without duplicate records or manual re-entry.

## New Table

### external_system_links
- `id` (uuid, primary key)
- `system_name` (text, not null — identifies the external system, e.g. 'synergy_crm')
- `entity_type` (text, not null — the type of local entity: 'profile', 'course', 'cohort', 'enrolment', 'certificate')
- `local_entity_id` (uuid, not null — the local record's ID)
- `external_entity_id` (text, not null — the ID in the external system)
- `metadata` (jsonb — extensible mapping data, e.g. external URLs, sync timestamps, field-level mappings)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- Unique constraint on (system_name, entity_type, external_entity_id) — one mapping per external record
- Unique constraint on (system_name, entity_type, local_entity_id) — one local record mapped per external system per entity type

## Security (RLS)

### external_system_links
- SELECT: administrators only — integration mappings are administrative data.
- INSERT/UPDATE/DELETE: administrators only.
- Future Edge Functions running with the service role key bypass RLS and can read/write mappings during synchronization.

## Important Notes
1. This table is intentionally generic — it can map any entity type (students, courses, cohorts, enrolments, certificates) to any external system.
2. `system_name` allows multiple external systems to coexist (e.g. 'synergy_crm', 'stripe', 'zoom').
3. `external_entity_id` is text (not uuid) because external systems may use different ID formats.
4. Do NOT use email address as the only permanent method of matching identities between systems — the external_entity_id provides a stable reference.
5. The `metadata` jsonb allows storing sync state, last-sync timestamps, field-level mapping details, and external URLs without schema changes.
6. During the beta, manual enrolment is the workflow — this table is ready for future API/Edge Function integration but is not actively used.
7. Future Edge Functions (running with the service role key, bypassing RLS) will handle:
   - Registration system → Synergy Academy: create/match student, enrol into cohort, grant LMS access
   - Synergy Academy → Registration system: sync progress, attendance, grades, completion, certificates
*/

CREATE TABLE IF NOT EXISTS external_system_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL,
  entity_type text NOT NULL,
  local_entity_id uuid NOT NULL,
  external_entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system_name, entity_type, external_entity_id),
  UNIQUE (system_name, entity_type, local_entity_id)
);

ALTER TABLE external_system_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_external_system_links_system_name ON external_system_links(system_name);
CREATE INDEX IF NOT EXISTS idx_external_system_links_entity_type ON external_system_links(entity_type);
CREATE INDEX IF NOT EXISTS idx_external_system_links_local_entity_id ON external_system_links(local_entity_id);
CREATE INDEX IF NOT EXISTS idx_external_system_links_external_entity_id ON external_system_links(external_entity_id);

CREATE OR REPLACE FUNCTION public.update_external_system_links_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_external_system_links_updated_at ON external_system_links;
CREATE TRIGGER trg_external_system_links_updated_at
  BEFORE UPDATE ON external_system_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_external_system_links_updated_at();

-- RLS: administrators only
DROP POLICY IF EXISTS "external_system_links_select_admin" ON external_system_links;
CREATE POLICY "external_system_links_select_admin"
  ON external_system_links FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "external_system_links_insert_admin" ON external_system_links;
CREATE POLICY "external_system_links_insert_admin"
  ON external_system_links FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "external_system_links_update_admin" ON external_system_links;
CREATE POLICY "external_system_links_update_admin"
  ON external_system_links FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "external_system_links_delete_admin" ON external_system_links;
CREATE POLICY "external_system_links_delete_admin"
  ON external_system_links FOR DELETE
  TO authenticated
  USING (public.is_admin());