import { createClient } from '@supabase/supabase-js';

// Admin client — used ONLY by backend scripts to WRITE data.
// Uses the service_role key which must NEVER be exposed to the browser.
// This file is only imported by scripts that run on the server / in cron jobs.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});
