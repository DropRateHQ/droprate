// scripts/calc-ev.mjs
// Calculates expected value (EV) per pack for every set based on:
//   - today's card prices (card_prices)
//   - pull rates (pull_rates) if available, else a default rarity model
// Writes results to set_ev_snapshots for today.
// Run with: npm run calc:ev

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const TODAY = new Date().toISOString().slice(0, 10);

// Modern packs contain ~10 cards. We model EV as the expected $ from "hit" slots.
// This DEFAULT model is used when a set has no curated pull_rates rows.
// It approximates: each pack has 1 guaranteed rare-or-better "hit" slot,
// and we estimate its value as the average market price of the set's hit cards,
// weighted down by how many hit cards exist (rarer = harder to pull a specific one).
//
// Once you add real pull_rates for a set, this is replaced by the precise model.

const HIT_RARITIES = new Set([
  'Rare',
  'Double Rare',
  'Rare Holo',
  'Rare Holo EX',
  'Rare Holo GX',
  'Rare Holo V',
  'Rare Holo VMAX',
  'Rare Holo VSTAR',
  'Ultra Rare',
  'Illustration Rare',
  'Special Illustration Rare',
  'Hyper Rare',
  'Rare Secret',
  'Rare Rainbow',
  'Rare Shiny',
  'Shiny Rare',
  'Shiny Ultra Rare',
  'ACE SPEC Rare',
  'Radiant Rare',
  'Amazing Rare',
  'Trainer Gallery Rare Holo',
  'Rare Holo LV.X',
  'Rare Prime',
  'LEGEND',
  'Promo',
]);

async function logJob(name, status, extra = {}) {
  await supabase.from('data_jobs').insert({
    job_name: name,
    status,
    finished_at: status === 'success' || status === 'failed' ? new Date().toISOString() : null,
    ...extra,
  });
}

// Get the best available market price for a card across its variants (today)
function bestPrice(variantRows) {
  let best = null;
  for (const r of variantRows) {
    const p = r.market_price ?? r.mid_price ?? null;
    if (p !== null && (best === null || Number(p) > best)) best = Number(p);
  }
  return best;
}

async function getPullRates(setId) {
  const { data } = await supabase
    .from('pull_rates')
    .select('rarity, pull_rate')
    .eq('set_id', setId);
  return data || [];
}

async function getSealedPackPrice(setId) {
  // Look for a single-pack sealed product's latest market price
  const { data: products } = await supabase
    .from('sealed_products')
    .select('id, product_type, packs_per_unit')
    .eq('set_id', setId);

  if (!products || products.length === 0) return null;

  // Prefer an explicit single pack; else derive from a booster box price / packs
  const singlePack = products.find((p) => p.product_type === 'single_pack');
  const box = products.find((p) => p.product_type === 'booster_box' && p.packs_per_unit);

  async function latestPrice(productId) {
    const { data } = await supabase
      .from('sealed_prices')
      .select('market_price, price_date')
      .eq('product_id', productId)
      .order('price_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.market_price ?? null;
  }

  if (singlePack) {
    const p = await latestPrice(singlePack.id);
    if (p) return Number(p);
  }
  if (box) {
    const p = await latestPrice(box.id);
    if (p && box.packs_per_unit) return Number(p) / box.packs_per_unit;
  }
  return null;
}

async function main() {
  await logJob('calc_ev', 'started');

  const { data: sets, error: setErr } = await supabase
    .from('sets')
    .select('id, name, pack_msrp');
  if (setErr) {
    await logJob('calc_ev', 'failed', { error_message: setErr.message });
    throw setErr;
  }

  const snapshots = [];

  for (const set of sets) {
    // Get all cards in the set with their rarity
    const { data: cards } = await supabase
      .from('cards')
      .select('id, rarity')
      .eq('set_id', set.id);

    if (!cards || cards.length === 0) continue;

    const cardIds = cards.map((c) => c.id);

    // Get today's prices for those cards
    const { data: prices } = await supabase
      .from('card_prices')
      .select('card_id, variant, market_price, mid_price')
      .eq('price_date', TODAY)
      .in('card_id', cardIds);

    if (!prices || prices.length === 0) continue;

    // Group prices by card
    const byCard = new Map();
    for (const p of prices) {
      if (!byCard.has(p.card_id)) byCard.set(p.card_id, []);
      byCard.get(p.card_id).push(p);
    }

    // Build per-card best price + rarity
    const cardValues = [];
    for (const c of cards) {
      const vrows = byCard.get(c.id);
      if (!vrows) continue;
      const price = bestPrice(vrows);
      if (price === null) continue;
      cardValues.push({ rarity: c.rarity, price });
    }

    if (cardValues.length === 0) continue;

    const totalSetRawValue = cardValues.reduce((sum, c) => sum + c.price, 0);

    // ---- EV calculation ----
    const pullRates = await getPullRates(set.id);
    let evPerPack = null;

    if (pullRates.length > 0) {
      // PRECISE MODEL: sum over rarities of (pull_rate * avg price of that rarity)
      const avgByRarity = new Map();
      const grouped = new Map();
      for (const c of cardValues) {
        if (!grouped.has(c.rarity)) grouped.set(c.rarity, []);
        grouped.get(c.rarity).push(c.price);
      }
      for (const [rarity, arr] of grouped) {
        avgByRarity.set(rarity, arr.reduce((a, b) => a + b, 0) / arr.length);
      }
      evPerPack = 0;
      for (const pr of pullRates) {
        const avg = avgByRarity.get(pr.rarity) ?? 0;
        evPerPack += Number(pr.pull_rate) * avg;
      }
    } else {
      // DEFAULT MODEL (no curated pull rates yet):
      // Treat the pack's hit slot as the average value of all "hit"-rarity cards.
      // Plus a small base value for commons/uncommons bulk (~$0.10/pack).
      const hits = cardValues.filter((c) => c.rarity && HIT_RARITIES.has(c.rarity));
      const hitAvg =
        hits.length > 0 ? hits.reduce((a, b) => a + b.price, 0) / hits.length : 0;
      // Assume ~1 hit slot per pack on average for modern sets.
      evPerPack = hitAvg + 0.1;
    }

    const packMarket = await getSealedPackPrice(set.id);
    const packMsrp = set.pack_msrp ? Number(set.pack_msrp) : null;

    snapshots.push({
      set_id: set.id,
      snapshot_date: TODAY,
      ev_per_pack: round2(evPerPack),
      total_set_raw_value: round2(totalSetRawValue),
      pack_market_price: packMarket !== null ? round2(packMarket) : null,
      pack_msrp: packMsrp,
      edge_vs_market: packMarket !== null ? round2(evPerPack - packMarket) : null,
      edge_vs_msrp: packMsrp !== null ? round2(evPerPack - packMsrp) : null,
      card_count_in_calc: cardValues.length,
    });

    console.log(`  ${set.name}: EV $${round2(evPerPack)} (${cardValues.length} priced cards)`);
  }

  // Upsert all snapshots
  for (let i = 0; i < snapshots.length; i += 100) {
    const batch = snapshots.slice(i, i + 100);
    const { error } = await supabase
      .from('set_ev_snapshots')
      .upsert(batch, { onConflict: 'set_id,snapshot_date' });
    if (error) {
      await logJob('calc_ev', 'failed', { error_message: error.message });
      throw error;
    }
  }

  await logJob('calc_ev', 'success', { records_processed: snapshots.length });
  console.log(`Done. ${snapshots.length} set EV snapshots for ${TODAY}.`);
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

main().catch((err) => {
  console.error('calc-ev failed:', err);
  process.exit(1);
});
