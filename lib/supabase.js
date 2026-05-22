import { createClient } from '@supabase/supabase-js';

// Public client — used by the website to READ data.
// These env vars are safe to expose (anon key is public by design).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});
