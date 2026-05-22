import { supabase } from '@/lib/supabase';
import SiteHeader from '@/components/SiteHeader';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 3600;

function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}$${Math.abs(Number(n)).toFixed(2)}`;
}
function fmtMonth(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export async function generateMetadata({ params }) {
  const { data: set } = await supabase.from('sets').select('name').eq('id', params.id).maybeSingle();
  return { title: set ? `${set.name} — DropRate` : 'Set — DropRate' };
}

export default async function SetDetailPage({ params }) {
  const { data: set } = await supabase
    .from('sets')
    .select('id, name, series, release_date, total_cards, logo_url')
    .eq('id', params.id)
    .maybeSingle();

  if (!set) notFound();

  // Latest EV snapshot
  const { data: ev } = await supabase
    .from('set_ev_snapshots')
    .select('*')
    .eq('set_id', set.id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Top cards by latest price
  const { data: cards } = await supabase
    .from('cards')
    .select('id, name, number, rarity, image_small')
    .eq('set_id', set.id);

  let topCards = [];
  if (cards && cards.length > 0) {
    const cardIds = cards.map((c) => c.id);
    // Get the most recent price date
    const { data: latestDate } = await supabase
      .from('card_prices')
      .select('price_date')
      .in('card_id', cardIds)
      .order('price_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestDate) {
      const { data: prices } = await supabase
        .from('card_prices')
        .select('card_id, market_price, mid_price')
        .eq('price_date', latestDate.price_date)
        .in('card_id', cardIds);

      const priceMap = new Map();
      for (const p of prices || []) {
        const val = p.market_price ?? p.mid_price ?? 0;
        const prev = priceMap.get(p.card_id) ?? 0;
        if (Number(val) > prev) priceMap.set(p.card_id, Number(val));
      }
      topCards = cards
        .map((c) => ({ ...c, price: priceMap.get(c.id) ?? 0 }))
        .sort((a, b) => b.price - a.price)
        .slice(0, 12);
    }
  }

  return (
    <>
      <SiteHeader />
      <div className="relative z-10 mx-auto max-w-[1320px] px-6 py-10">
        <Link href="/" className="mb-6 inline-block text-sm text-text-dim hover:text-text">
          ← Leaderboard
        </Link>

        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-2 text-sm text-text-muted">
              {set.series} · {fmtMonth(set.release_date)} · {set.total_cards || '?'} cards
            </div>
            <h1 className="font-display text-[clamp(32px,5vw,56px)] font-bold tracking-[-0.03em]">
              {set.name}
            </h1>
          </div>
        </div>

        {/* EV summary cards */}
        <div className="mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="EV per Pack" value={fmtMoney(ev?.ev_per_pack)} accent />
          <SummaryCard label="Pack Market" value={fmtMoney(ev?.pack_market_price)} />
          <SummaryCard
            label="Edge vs Market"
            value={fmtMoney(ev?.edge_vs_market)}
            color={ev?.edge_vs_market >= 0 ? 'green' : 'red'}
          />
          <SummaryCard label="Total Set Value" value={fmtMoney(ev?.total_set_raw_value)} />
        </div>

        {/* Top cards */}
        <h2 className="mb-5 font-display text-2xl font-semibold">Most Valuable Cards</h2>
        {topCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {topCards.map((c) => (
              <div
                key={c.id}
                className="overflow-hidden rounded-xl border border-border bg-bg-elev p-3"
              >
                {c.image_small ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_small}
                    alt={c.name}
                    className="mb-3 w-full rounded-lg"
                    loading="lazy"
                  />
                ) : (
                  <div className="mb-3 aspect-[2.5/3.5] w-full rounded-lg bg-bg-elev-2" />
                )}
                <div className="truncate text-sm font-semibold">{c.name}</div>
                <div className="mt-0.5 truncate text-xs text-text-muted">
                  {c.rarity || '—'} · #{c.number}
                </div>
                <div className="mt-1.5 font-display text-lg font-bold text-lime">
                  {fmtMoney(c.price)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-bg-elev p-12 text-center text-text-dim">
            Card prices for this set will appear after the next data refresh.
          </div>
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value, accent, color }) {
  let valueClass = 'text-text';
  if (accent) valueClass = 'text-lime';
  if (color === 'green') valueClass = 'text-brand-green';
  if (color === 'red') valueClass = 'text-brand-red';
  return (
    <div className="rounded-xl border border-border bg-bg-elev p-5">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
        {label}
      </div>
      <div className={`font-display text-[26px] font-bold tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
