import SiteHeader from '@/components/SiteHeader';
import Link from 'next/link';

export default function ComingSoon({ title, description }) {
  return (
    <>
      <SiteHeader />
      <div className="relative z-10 mx-auto flex max-w-[1320px] flex-col items-center px-6 py-32 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime/20 bg-lime/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lime">
          Coming soon
        </div>
        <h1 className="mb-4 font-display text-[clamp(32px,5vw,52px)] font-bold tracking-[-0.03em]">
          {title}
        </h1>
        <p className="mb-8 max-w-md text-base text-text-dim">{description}</p>
        <Link
          href="/"
          className="rounded-md bg-lime px-5 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
        >
          ← Back to leaderboard
        </Link>
      </div>
    </>
  );
}
