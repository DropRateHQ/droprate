# DropRate

Pokémon TCG pack EV and market analytics. Live TCGplayer prices + pull rates → expected value of every set.

## Stack

- **Next.js 14** (App Router) — website
- **Supabase** (PostgreSQL) — database
- **GitHub Actions** — daily data refresh cron
- **Vercel** — hosting

## Environment Variables

See `.env.example`. Set the `NEXT_PUBLIC_*` vars in Vercel for the website, and the secret vars in GitHub repo Secrets for the data scripts.

## Data Scripts

```bash
npm run fetch:sets    # Pull all Pokemon sets
npm run fetch:cards   # Pull all cards + today's prices
npm run calc:ev       # Compute set EV snapshots
```

These run automatically every day via `.github/workflows/daily-refresh.yml`.

## Local Development

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

Open http://localhost:3000
