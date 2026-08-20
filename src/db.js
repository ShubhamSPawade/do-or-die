import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SERVICE_ROLE_KEY;

if(!url || !key || url.includes('PASTE') || key.includes('PASTE')){
  console.error('Missing SUPABASE_URL / SERVICE_ROLE_KEY in .env — see supabase-setup.sql for setup.');
  process.exit(1);
}

// service-role client: server-side only, bypasses RLS
export const supabase = createClient(url, key, { auth: { persistSession: false } });