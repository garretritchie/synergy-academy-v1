import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import {seed,tests} from './fixtures/assessment-sessions.mjs';
const db=new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb);
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
GRANT USAGE ON SCHEMA public,auth,storage TO authenticated,anon;GRANT SELECT ON auth.users TO authenticated;
`);
const files=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!f.endsWith('.sql.sql')&&!f.includes('_016_')).sort();
let fixture;
for(const file of files){try{if(file.includes('_024_'))fixture=await seed(db);await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'));console.log(`PASS ${file}`);}catch(e){console.error(`FAIL ${file}: ${e.message}`);process.exitCode=1;await db.close();process.exit();}}
try{await tests(db,fixture);}catch(e){console.error(e);process.exitCode=1;}
console.log('Isolated PostgreSQL checks finished. Auth/storage are stubs; extension-only migration 016 is excluded. No remote database changed.');
await db.close();
