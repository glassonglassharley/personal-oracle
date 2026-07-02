# Personal Oracle Monorepo Apps

This folder contains the sibling apps merged into the `glassonglassharley/personal-oracle` repository.

| App | Path | Stack | Dev command |
|---|---|---|---|
| Vice Tracker | `../client` + `../server` | React/Vite + Express/Postgres | `npm run dev` (repo root) |
| Growth Mirror (training-log) | `training-log/` | React/Vite + Vercel serverless API | `npm run dev:training-log` |
| Income Growth Tracker (pre-game) | `pre-game/` | Next.js 16 | `npm run dev:pre-game` |
| Debt Assassination | `debt-assassination/` | React/Vite + Vercel serverless API | `npm run dev:debt-assassination` |

## Setup

From the repo root:

```bash
npm run install:all
```

Each app keeps its own `.env` / `.env.local` files. Copy them from your old project folders if needed — secrets were not copied during the merge.

## Deploying

- **Vice Tracker** deploys from the repo root (existing Vercel project).
- **Sibling apps** can be deployed as separate Vercel projects with their **Root Directory** set to `apps/training-log`, `apps/pre-game`, or `apps/debt-assassination`.

## Source repos (archived)

These apps were merged from:

- https://github.com/glassonglassharley/training-log
- https://github.com/glassonglassharley/pre-game
- https://github.com/glassonglassharley/Debt-Assassination
