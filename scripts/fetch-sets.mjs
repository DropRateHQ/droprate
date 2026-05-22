// scripts/fetch-sets.mjs
// Fetches all Pokemon TCG sets from pokemontcg.io and upserts them into Supabase.
// Run with: npm run fetch:sets

import { createClient } from '@supabase/supabase-js';

const POKEMON_API_KEY = process.env.POKEMON_TCG_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function logJob(name, status, extra = {}) {
  await supabase.from('data_jobs').insert({
    job_name: name,
    status,
    finished_at: status === 'success' || status === 'failed' ? new Date().toISOString() : null,
    ...extra,
  });
}

async function main() {
  console.log('Fetching Pokemon sets...');
  await logJob('fetch_sets', 'started');

  const headers = POKEMON_API_KEY ? { 'X-Api-Key': POKEMON_API_KEY } : {};
  const res = await fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250', {
    headers,
  });

  if (!res.ok) {
    const msg = `pokemontcg.io returned ${res.status}`;
    await logJob('fetch_sets', 'failed', { error_message: msg });
    throw new Error(msg);
  }

  const json = await res.json();
  const sets = json.data || [];
  console.log(`Got ${sets.length} sets.`);

  const rows = sets.map((s) => ({
    id: s.id,
    name: s.name,
    series: s.series,
    release_date: s.releaseDate ? s.releaseDate.replace(/\//g, '-') : null,
    total_cards: s.total ?? null,
    printed_total: s.printedTotal ?? null,
    symbol_url: s.images?.symbol ?? null,
    logo_url: s.images?.logo ?? null,
    ptcgo_code: s.ptcgoCode ?? null,
    updated_at: new Date().toISOString(),
  }));

  // Upsert in batches of 100
  let processed = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from('sets').upsert(batch, { onConflict: 'id' });
    if (error) {
      await logJob('fetch_sets', 'failed', { error_message: error.message, records_processed: processed });
      throw error;
    }
    processed += batch.length;
    console.log(`Upserted ${processed}/${rows.length}`);
  }

  await logJob('fetch_sets', 'success', { records_processed: processed });
  console.log(`Done. ${processed} sets saved.`);
}

main().catch((err) => {
  console.error('fetch-sets failed:', err);
  process.exit(1);
});
