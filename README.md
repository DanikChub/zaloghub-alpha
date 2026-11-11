# ZalogHub Alpha

Platform for finding and managing real estate-backed loans.

## Repository layout

- `apps/web` — frontend.
- `apps/api` — NestJS backend with Prisma/PostgreSQL.
- `docs/architecture` — logical data model and editable diagrams.

## Local development

With dependencies installed and the API environment configured:

```powershell
pnpm dev:web
# In another terminal:
pnpm dev:api
```

## Database

The application currently uses one backend and one PostgreSQL database. Financial accounting is being developed as a module inside that application.

```powershell
pnpm --dir apps/api db:generate
pnpm --dir apps/api db:status
pnpm --dir apps/api db:migrate
```

See [the database implementation notes](apps/api/prisma/README.md) for the migration scope, compatibility with existing data, history constraints, and integration test instructions. The financial foundation migration adds the storage model; it does not yet implement accrual formulas or switch existing endpoints to the new accounting model.

Manual operations now use a pure chronological loan calculator through the existing
deal tables. See [manual finance](docs/architecture/manual-finance.md) for API routes,
contract profile configuration, working calendars, supported rules and tests. The
financial foundation tables are not yet the source for this calculation.

## Маркетплейс предложений

Перенос Telegram-агрегатора, запуск API и отдельного сборщика, конфигурация источников и проверки описаны в [docs/marketplace.md](docs/marketplace.md).
