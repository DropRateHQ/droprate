import { supabase } from '@/lib/supabase';
import SiteHeader from '@/components/SiteHeader';
import Link from 'next/link';

// Revalidate the page every hour (prices update daily, this is plenty fresh)
export const revalidate = 3600;

async function getLeaderboard() {
  // Find the most recent snapshot date we have data for
  const { data: latestSnap } = await supabase
    .from('set_ev_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestSnap) return { rows: [], snapshotDate: null };

  const snapshotDate = latestSnap.snapshot_date;

  // Pull all set EV snapshots for that date, joined to set info
  const { data: rows } = await supabase
    .from('set_ev_snapshots')
    .select(
      `
      ev_per_pack,
      pack_market_price,
      pack_msrp,
      edge_vs_market,
      edge_vs_msrp,
      total_set_raw_value,
      sets ( id, name, series, release_date, logo_url )
    `
    )
    .eq('snapshot_date', snapshotDate)
    .order('edge_vs_market', { ascending: false, nullsFirst: false });

  return { rows: rows || [], snapshotDate };
}

function fmtMoney(n) {
  if (n === null || n === undefined) return '—';
  const sign = n < 0 ? '−' : '';
  return `${sign}$${Math.abs(Number(n)).toFixed(2)}`;
}

function fmtMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function setInitials(name) {
  if (!name) return '?';
  const words = name.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

export default async function HomePage() {
  const { rows, snapshotDate } = await getLeaderboard();

  const hasData = rows.length > 0;
  const topEdge = hasData ? rows[0].edge_vs_market : null;

  return (
    <>
      <SiteHeader lastUpdated={snapshotDate ? fmtMonth(snapshotDate) : null} />

      {/* HERO */}
      <section className="relative z-10 mx-auto max-w-[1320px] px-6 pb-8 pt-14">
        <div className="grid items-end gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime/20 bg-lime/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lime">
              ● Pokémon pack intelligence
            </div>
            <h1 className="mb-5 font-display text-[clamp(40px,7vw,80px)] font-bold leading-[0.92] tracking-[-0.045em]">
              The real value
              <br />
              of every <span className="italic font-semibold text-lime">pack</span>,
              <br />
              tracked daily.
            </h1>
            <p className="max-w-[520px] text-[18px] leading-relaxed text-text-dim">
              Live TCGplayer market prices combined with verified pull rates — so collectors and
              investors know the true expected value of every Pokémon set.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-bg-elev">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/40 to-transparent" />
            <div className="grid grid-cols-2">
              <Stat label="Sets Tracked" value={hasData ? rows.length : '—'} />
              <Stat
                label="Top Edge Today"
                value={hasData ? fmtMoney(topEdge) : '—'}
                accent="lime"
                unit="/pack"
              />
              <Stat
                label="Data Source"
                value="TCGplayer"
                small
              />
              <Stat
                label="Last Refresh"
                value={snapshotDate ? fmtMonth(snapshotDate) : '—'}
                small
              />
            </div>
          </div>
        </div>
      </section>

      {/* TAB BAR */}
      <div className="relative z-10 mx-auto mt-14 flex max-w-[1320px] flex-wrap items-end justify-between gap-4 px-6">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-[10px] border border-border bg-bg-elev p-1">
          <Tab active>Best Edge</Tab>
          <Tab>Pack Value</Tab>
          <Tab>Set Value</Tab>
          <Tab>Gem Rate</Tab>
          <Tab>Trending</Tab>
        </div>
        <div className="text-xs text-text-muted">
          Sorted by <span className="text-text-dim">edge vs. market price</span>
          {hasData ? ` · ${rows.length} sets` : ''}
        </div>
      </div>

      {/* TABLE */}
      <div className="relative z-10 mx-auto mt-6 max-w-[1320px] px-6 pb-20">
        <div className="overflow-hidden rounded-[14px] border border-border bg-bg-elev">
          {hasData ? (
            <table className="w-full border-collapse">
              <thead className="bg-bg-elev-2">
                <tr className="border-b border-border">
                  <Th className="w-[60px]">Rank</Th>
                  <Th>Set</Th>
                  <Th num>Pack (Mkt)</Th>
                  <Th num className="hidden md:table-cell">
                    EV / Pack
                  </Th>
                  <Th num>Edge</Th>
                  <Th num className="hidden md:table-cell">
                    Set Value
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const s = row.sets;
                  if (!s) return null;
                  const edge = row.edge_vs_market;
                  const profit = edge !== null && Number(edge) >= 0;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-bg-elev-2"
                    >
                      <td className="px-5 py-4">
                        <RankBox n={i + 1} />
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/sets/${s.id}`} className="flex items-center gap-3.5">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elev-2 font-display text-[13px] font-bold text-text">
                            {setInitials(s.name)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-text">{s.name}</div>
                            <div className="mt-0.5 text-xs text-text-muted">
                              {s.series} · {fmtMonth(s.release_date)}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-[13px] font-medium text-text-dim">
                        {fmtMoney(row.pack_market_price)}
                      </td>
                      <td className="hidden px-5 py-4 text-right font-display text-[18px] font-bold text-text md:table-cell">
                        {fmtMoney(row.ev_per_pack)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span
                          className={
                            profit
                              ? 'inline-flex items-center gap-1 rounded-md bg-brand-green/10 px-2.5 py-1.5 font-mono text-[13px] font-semibold text-brand-green'
                              : 'inline-flex items-center gap-1 rounded-md bg-brand-red/10 px-2.5 py-1.5 font-mono text-[13px] font-semibold text-brand-red'
                          }
                        >
                          {fmtMoney(edge)}
                        </span>
                      </td>
                      <td className="hidden px-5 py-4 text-right font-mono text-[13px] text-text-dim md:table-cell">
                        {fmtMoney(row.total_set_raw_value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      <footer className="relative z-10 mx-auto max-w-[1320px] border-t border-border px-6 pb-16 pt-8 text-center text-xs text-text-muted">
        <span className="text-text-dim">DropRate</span> · Pokémon TCG market analytics · Prices via
        TCGplayer & pokemontcg.io
      </footer>
    </>
  );
}

function Stat({ label, value, accent, unit, small }) {
  return (
    <div className="border-b border-r border-border p-5 last:border-r-0 [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-text-muted">
        {label}
      </div>
      <div
        className={`font-display font-bold tracking-tight ${small ? 'text-[20px]' : 'text-[28px]'} ${
          accent === 'lime' ? 'text-lime' : 'text-text'
        }`}
      >
        {value}
        {unit && <span className="ml-0.5 font-sans text-[13px] font-medium text-text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function Tab({ children, active }) {
  return (
    <button
      className={
        active
          ? 'whitespace-nowrap rounded-[7px] bg-bg-elev-2 px-4 py-2.5 text-[13px] font-medium text-text shadow-[0_0_0_1px_#2e3247]'
          : 'whitespace-nowrap rounded-[7px] px-4 py-2.5 text-[13px] font-medium text-text-dim transition-colors hover:text-text'
      }
    >
      {children}
    </button>
  );
}

function Th({ children, num, className = '' }) {
  return (
    <th
      className={`px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted ${
        num ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

function RankBox({ n }) {
  let cls =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-bg-elev-2 font-display text-sm font-bold text-text-dim';
  if (n === 1)
    cls =
      'flex h-9 w-9 items-center justify-center rounded-lg border border-lime bg-gradient-to-br from-lime to-[#a8ff00] font-display text-sm font-bold text-bg shadow-[0_0_16px_rgba(212,255,58,0.4)]';
  else if (n === 2)
    cls =
      'flex h-9 w-9 items-center justify-center rounded-lg border border-lime/30 bg-bg-elev-2 font-display text-sm font-bold text-lime';
  else if (n === 3)
    cls =
      'flex h-9 w-9 items-center justify-center rounded-lg border border-border-bright bg-bg-elev-2 font-display text-sm font-bold text-text';
  return <div className={cls}>{String(n).padStart(2, '0')}</div>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-bg-elev-2">
        <span className="h-3 w-3 animate-pulse-dot rounded-full bg-lime" />
      </div>
      <h3 className="mb-2 font-display text-xl font-semibold text-text">Data pipeline warming up</h3>
      <p className="max-w-md text-sm text-text-dim">
        Your site is live and connected to the database. Once the daily price fetch runs for the
        first time, the leaderboard will populate automatically with live Pokémon set values.
      </p>
    </div>
  );
}
