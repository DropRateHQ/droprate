import { supabase } from '@/lib/supabase';
import SiteHeader from '@/components/SiteHeader';
import Link from 'next/link';

export const revalidate = 3600;
export const metadata = { title: 'All Sets — DropRate' };

function fmtMonth(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function setInitials(name) {
  if (!name) return '?';
  const words = name.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
}

export default async function SetsPage() {
  const { data: sets } = await supabase
    .from('sets')
    .select('id, name, series, release_date, total_cards')
    .order('release_date', { ascending: false });

  const list = sets || [];

  return (
    <>
      <SiteHeader />
      <div className="relative z-10 mx-auto max-w-[1320px] px-6 py-12">
        <h1 className="mb-2 font-display text-[clamp(32px,5vw,48px)] font-bold tracking-[-0.03em]">
          All Sets
        </h1>
        <p className="mb-10 text-text-dim">
          {list.length > 0 ? `${list.length} Pokémon TCG sets tracked.` : 'Sets will appear here once the data pipeline runs.'}
        </p>

        {list.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((s) => (
              <Link
                key={s.id}
                href={`/sets/${s.id}`}
                className="group flex items-center gap-4 rounded-xl border border-border bg-bg-elev p-4 transition-colors hover:border-border-bright hover:bg-bg-elev-2"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-bg-elev-2 font-display text-sm font-bold text-text group-hover:text-lime">
                  {setInitials(s.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-text">{s.name}</div>
                  <div className="mt-0.5 text-xs text-text-muted">
                    {s.series} · {fmtMonth(s.release_date)} · {s.total_cards || '?'} cards
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-bg-elev p-16 text-center text-text-dim">
            No sets loaded yet.
          </div>
        )}
      </div>
    </>
  );
}
