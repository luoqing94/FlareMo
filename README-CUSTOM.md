# Customizations (luoqing94)

Upstream app: realchendahuang/FlareMo (this fork tracks upstream + local workflow commits).

Live customizations:
- `edgeone-proxy/` — EdgeOne reverse-proxy to the Cloudflare Worker origin.

Secrets / `.env` are **not** stored in this repo.

## EdgeOne proxy environment variables

Set these in the EdgeOne console (values never belong in git):

- `ORIGIN_HOST` — Cloudflare Worker hostname only (no scheme). Fallback: `CHANGE_ME.workers.dev`.
- `TEO_VERIFICATION` — body for `/.well-known/teo-verification/5fez15h45z.txt`, served by the edge function only (no static file). Fallback: `CHANGE_ME_TEO_VERIFICATION`.
