import Link from 'next/link';

export default function SiteHeader({ lastUpdated }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-8 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-1 font-display text-[22px] font-extrabold tracking-tight">
          <span
            className="rounded bg-gradient-to-br from-lime to-[#a8ff00] px-2.5 py-0.5 text-bg"
            style={{ transform: 'rotate(-2deg)', boxShadow: '0 0 24px rgba(212,255,58,0.3)' }}
          >
            DROP
          </span>
          <span className="text-text">rate</span>
        </Link>

        <nav className="hidden items-center gap-1 text-[13px] font-medium md:flex">
          <NavLink href="/" active>
            Leaderboard
          </NavLink>
          <NavLink href="/cards">Cards</NavLink>
          <NavLink href="/sealed">Sealed</NavLink>
          <NavLink href="/calculator">Calculator</NavLink>
          <NavLink href="/sets">Sets</NavLink>
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-bg-elev px-3 py-1.5 text-xs text-text-dim">
            <span className="h-[7px] w-[7px] animate-pulse-dot rounded-full bg-brand-green shadow-[0_0_8px_#2dd674]" />
            {lastUpdated ? `Updated ${lastUpdated}` : 'Live'}
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children, active }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-md bg-lime px-3.5 py-2 font-semibold text-bg'
          : 'rounded-md px-3.5 py-2 text-text-dim transition-colors hover:bg-bg-elev hover:text-text'
      }
    >
      {children}
    </Link>
  );
}
