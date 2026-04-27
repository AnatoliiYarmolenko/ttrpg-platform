# TTRPG Platform

[![GitHub CI](https://github.com/Kvarell/ttrpg-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Kvarell/ttrpg-platform/actions/workflows/ci.yml)
[![Sonar Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=Kvarell_ttrpg-platform&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Kvarell_ttrpg-platform)
[![Sonar Coverage](https://sonarcloud.io/api/project_badges/measure?project=Kvarell_ttrpg-platform&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Kvarell_ttrpg-platform)

Платформа для організації TTRPG-кампаній і сесій: керування кампаніями, учасниками, ролями, календарем, безпекою доступу та журналюванням клієнтських подій.

## Tech Stack

- Frontend: React 19, Vite 7, React Router 7, TanStack Query, Zustand, Tailwind CSS
- Backend: Node.js 22, Express 5, Prisma ORM
- Database: PostgreSQL 15
- Cache and rate limiting: Redis 7
- Containerization: Docker, Docker Compose
- CI: GitLab CI + GitHub Actions
- Testing (Backend): Node test runner + c8 coverage
- Testing (Frontend): Vitest + Testing Library + jsdom + V8 coverage

## Dependency Management (Root-Only Workspaces)

Проєкт працює у режимі root-only npm workspaces:

- єдиний lock-файл: `package-lock.json` у корені;
- інсталяція залежностей виконується з кореня;
- CI також використовує root install (`npm ci`) і запускає workspace-скрипти.

Не створюйте окремі lock-файли у `client/` або `server/`.

## Quick Start

### 1. Install dependencies

```bash
npm ci
```

### 2. Run locally (without Docker)

```bash
npm run dev:server
npm run dev:client
```

### 3. Run with Docker Compose

```bash
docker compose up --build
```

## Common Scripts

```bash
# Build
npm run build
npm run build:client

# Lint
npm run lint
npm run lint:client
npm run lint:server

# Tests
npm run test
npm run test:client
npm run test:server
npm run test:e2e

# Coverage
npm run test:coverage
npm run test:coverage:client
npm run test:coverage:server
```

## Coverage Output

- Frontend: `client/coverage/` (including `lcov.info`)
- Backend: `server/coverage/` (including `lcov.info`)

## CI Overview

GitHub Actions pipeline includes:

- build_server
- build_client
- lint_client
- lint_server
- coverage_client
- coverage_server
- sonarcloud

Усі кроки інсталяції в GitHub CI виконуються через `npm ci` з кореня.
