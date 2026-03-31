# TTRPG Platform

[![GitHub CI](https://github.com/Kvarell/ttrpg-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Kvarell/ttrpg-platform/actions/workflows/ci.yml)
[![Sonar Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Kvarell_ttrpg-platform&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Kvarell_ttrpg-platform)
[![Sonar Coverage](https://sonarcloud.io/api/project_badges/measure?project=Kvarell_ttrpg-platform&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Kvarell_ttrpg-platform)

Платформа для організації TTRPG-кампаній і сесій: керування кампаніями, учасниками, ролями, календарем, безпекою доступу та журналюванням клієнтських подій.

## Tech Stack

- Frontend: React 19, Vite 7, React Router 7, TanStack Query, Zustand, Tailwind CSS
- Backend: Node.js, Express 5, Prisma ORM
- Database: PostgreSQL
- Cache/Rate limiting: Redis
- Containerization: Docker, Docker Compose
- CI: GitLab CI + GitHub Actions
- Testing (Backend): Node test runner + c8 coverage
- Testing (Frontend): Vitest + Testing Library + jsdom + V8 coverage

## Quick Start

### 1. Install dependencies

```bash
npm --prefix server ci
npm --prefix client ci
```

### 2. Run locally (without Docker)

```bash
npm --prefix server run dev
npm --prefix client run dev
```

### 3. Run with Docker Compose

```bash
docker compose up --build
```

## Testing And Coverage

### Backend

```bash
npm --prefix server run test
npm --prefix server run test:coverage
```

Coverage artifacts are generated in:

- `server/coverage/`
- `server/coverage/lcov.info`

### Frontend

```bash
npm --prefix client run test
npm --prefix client run test:coverage
```

Coverage artifacts are generated in:

- `client/coverage/`
- `client/coverage/lcov.info`
- `client/coverage/coverage-summary.json`

## CI

Pipeline checks currently include:

- build_server
- build_client
- lint_client
- coverage_client
- coverage_server
- sonarcloud_scan (GitLab)
- sonarcloud (GitHub)

Coverage values for frontend and backend are parsed in GitLab jobs and stored as pipeline artifacts.
