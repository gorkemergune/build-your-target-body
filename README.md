# Build Your Target Body

An AI-powered body transformation tracker built for Turkish users — with full English support. Track weight, body fat, measurements, nutrition, and workouts. Visualize progress with charts and get an estimated completion date for your goals.

---

## Features

- **Goal tracking** — weight loss, weight gain, body recomposition, muscle gain
- **Weight & body fat tracking** — daily logs, trend charts, weekly averages
- **Body measurements** — 8 measurements with per-field trend charts
- **Nutrition tracking** — daily macros (calories, protein, carbs, fat, water) + food journal
- **Workout tracking** — exercises, sets, reps, weight, volume analytics
- **Progress photos** — upload, gallery, side-by-side comparison with diff stats
- **Analytics dashboard** — goal progress engine, ETA, consistency score, weekly averages
- **AI Coach** — Gemini-powered chat with full user context
- **AI Reports** — weekly/monthly PDF reports
- **PWA** — installable on Android, iPhone, and desktop; offline support
- **Turkish / English** — full i18n via `next-intl`

---

## Local Development

### Prerequisites

- Docker and Docker Compose
- A Gemini API key (optional — AI features degrade gracefully)

### Quick start

```bash
cp .env.example .env
# Edit .env: set GEMINI_API_KEY, JWT_SECRET
docker compose up -d
```

Frontend: http://localhost:3000
Backend API: http://localhost:8000
API Docs: http://localhost:8000/docs

**Every code change requires a rebuild** — code is baked into images at build time:

```bash
docker compose build backend && docker compose up -d backend
docker compose build frontend && docker compose up -d frontend
```

---

## Production Deployment

### 1. Prepare environment

```bash
cp .env.production.example .env.production
```

Edit `.env.production`:

- Set a strong `POSTGRES_PASSWORD` (use `openssl rand -hex 16`)
- Set a strong `JWT_SECRET` (use `openssl rand -hex 32`)
- Set `GEMINI_API_KEY`
- Set `CORS_ORIGINS` to your domain (e.g. `https://yourdomain.com`)
- Set `NEXT_PUBLIC_API_URL` to your domain
- Optionally set `SENTRY_DSN` for error tracking

### 2. Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Differences from dev:

- DB port not exposed externally
- `restart: always` on all services
- Uvicorn runs with `--workers 2`
- API docs disabled (`SHOW_DOCS=false`)

### 3. Health check

```bash
curl https://yourdomain.com/health
# {"status":"ok","db":"ok","gemini":"configured","storage":"ok","environment":"production"}
```

---

## Backup & Restore

### Backup

```bash
./scripts/backup.sh
# Saves to ./backups/YYYYMMDD_HHMMSS/
```

Creates:

- `db.sql` — full PostgreSQL dump
- `uploads.tar.gz` — all user-uploaded photos

### Restore

```bash
./scripts/restore.sh ./backups/20240115_103000
```

### Automated daily backups (cron)

```cron
0 2 * * * cd /path/to/app && ./scripts/backup.sh >> ./backups/backup.log 2>&1
```

---

## Environment Variables

| Variable                | Required | Description                                                  |
| ----------------------- | -------- | ------------------------------------------------------------ |
| `DATABASE_URL`        | Yes      | PostgreSQL connection string                                 |
| `JWT_SECRET`          | Yes      | Secret for JWT signing (min 32 chars)                        |
| `GEMINI_API_KEY`      | No       | Google Gemini API key for AI features                        |
| `CORS_ORIGINS`        | Yes      | Comma-separated allowed origins                              |
| `NEXT_PUBLIC_API_URL` | Yes      | Backend URL visible to the browser                           |
| `ENVIRONMENT`         | No       | `development` or `production` (default: `development`) |
| `LOG_LEVEL`           | No       | `INFO`, `WARNING`, `ERROR` (default: `INFO`)         |
| `SHOW_DOCS`           | No       | Show `/docs` endpoint (default: `true`)                  |
| `SENTRY_DSN`          | No       | Sentry DSN for error tracking                                |

---

## Production Checklist

- [ ] Strong `POSTGRES_PASSWORD` (not default)
- [ ] Strong `JWT_SECRET` (at least 64 chars)
- [ ] `CORS_ORIGINS` restricted to your domain
- [ ] `SHOW_DOCS=false` in production
- [ ] HTTPS configured (reverse proxy — nginx/Caddy/Traefik)
- [ ] Daily backup cron running
- [ ] Test restore from backup
- [ ] Health endpoint returning `"status":"ok"`

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full planned feature list.

Currently implemented: Phases 1–11.

---

## License

MIT
