// scripts/fetch-cards.mjs
// Fetches all cards (with current TCGplayer prices) for every set in the DB.
// Stores card metadata in `cards` and today's prices in `card_prices`.
// Run with: npm run fetch:cards

import { createClient } from '@supabase/supabase-js';

const POKEMON_API_KEY = process.env.POKEMON_TCG_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const headers = POKEMON_API_KEY ? { 'X-Api-Key': POKEMON_API_KEY } : {};
const TODAY = new Date().toISOString().slice(0, 10);

async function logJob(name, status, extra = {}) {
  await supabase.from('data_jobs').insert({
    job_name: name,
    status,
    finished_at: status === 'success' || status === 'failed' ? new Date().toISOString() : null,
    ...extra,
  });
}

// Fetch every card for a single set (handles pagination)
async function fetchCardsForSet(setId) {
  let page = 1;
  const all = [];
  while (true) {
    const url = `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=250`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`cards fetch for ${setId} returned ${res.status}`);
    const json = await res.json();
    const data = json.data || [];
    all.push(...data);
    if (data.length < 250) break;
    page += 1;
  }
  return all;
}

function buildCardRow(c) {
  return {
    id: c.id,
    set_id: c.set?.id ?? null,
    name: c.name,
    number: c.number ?? null,
    rarity: c.rarity ?? null,
    supertype: c.supertype ?? null,
    subtypes: c.subtypes ?? null,
    types: c.types ?? null,
    image_small: c.images?.small ?? null,
    image_large: c.images?.large ?? null,
    tcgplayer_id: c.tcgplayer?.url ? extractTcgId(c.tcgplayer.url) : null,
    tcgplayer_url: c.tcgplayer?.url ?? null,
    updated_at: new Date().toISOString(),
  };
}

function extractTcgId(url) {
  // TCGplayer URLs look like https://prices.pokemontcg.io/tcgplayer/<id>
  const m = url.match(/\/(\d+)(?:\?|$)/);
  return m ? m[1] : null;
}

// Build price rows from the tcgplayer.prices object (one row per variant)
function buildPriceRows(c) {
  const prices = c.tcgplayer?.prices;
  if (!prices) return [];
  const rows = [];
  for (const [variant, p] of Object.entries(prices)) {
    if (!p) continue;
    rows.push({
      card_id: c.id,
      price_date: TODAY,
      variant,
      market_price: p.market ?? null,
      low_price: p.low ?? null,
      mid_price: p.mid ?? null,
      high_price: p.high ?? null,
      direct_low: p.directLow ?? null,
      source: 'pokemontcg.io',
    });
  }
  return rows;
}

async function main() {
  await logJob('fetch_cards', 'started');

  const { data: sets, error: setErr } = await supabase
    .from('sets')
    .select('id, name')
    .order('release_date', { ascending: false });

  if (setErr) {
    await logJob('fetch_cards', 'failed', { error_message: setErr.message });
    throw setErr;
  }

  console.log(`Fetching cards for ${sets.length} sets...`);
  let totalCards = 0;
  let totalPrices = 0;

  for (const set of sets) {
    try {
      const cards = await fetchCardsForSet(set.id);
      if (cards.length === 0) continue;

      const cardRows = cards.map(buildCardRow);
      const priceRows = cards.flatMap(buildPriceRows);

      // Upsert cards
      for (let i = 0; i < cardRows.length; i += 200) {
        const batch = cardRows.slice(i, i + 200);
        const { error } = await supabase.from('cards').upsert(batch, { onConflict: 'id' });
        if (error) throw error;
      }

      // Upsert prices (unique on card_id + date + variant)
      for (let i = 0; i < priceRows.length; i += 200) {
        const batch = priceRows.slice(i, i + 200);
        const { error } = await supabase
          .from('card_prices')
          .upsert(batch, { onConflict: 'card_id,price_date,variant' });
        if (error) throw error;
      }

      totalCards += cardRows.length;
      totalPrices += priceRows.length;
      console.log(`  ${set.name}: ${cardRows.length} cards, ${priceRows.length} prices`);

      // Be polite to the API
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      console.error(`  Error on set ${set.id}:`, err.message);
      // Continue with other sets rather than failing the whole run
    }
  }

  await logJob('fetch_cards', 'success', {
    records_processed: totalCards,
    notes: { total_prices: totalPrices },
  });
  console.log(`Done. ${totalCards} cards, ${totalPrices} price rows for ${TODAY}.`);
}

main().catch((err) => {
  console.error('fetch-cards failed:', err);
  process.exit(1);
});
