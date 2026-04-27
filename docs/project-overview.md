# TTRPG Platform: Project Overview

> Останнє оновлення: 2026-04-26

## 1. Що Це За Проєкт

`TTRPG Platform` — це full-stack вебзастосунок для організації настільних рольових ігор. Система поєднує:

- різні моделі видимості та доступу до кампаній і сесій;
- календарне планування ігор;
- рольову модель для кампаній та сесій;
- join-flow для вступу в кампанії та окремі сесії;
- базову інфраструктуру для безпечної автентифікації, email-флоу, профілів, chat і майбутніх фінансових сценаріїв.

Проєкт побудований як SPA-клієнт на React та REST API на Express + Prisma + PostgreSQL.

---

## 2. Головні Доменні Сутності

У системі є два основні домени:

- `Campaign` — довготривала кампанія зі складом учасників, ролями і власними сесіями.
- `Session` — окрема гра, яка може бути:
  - `one-shot`, якщо не прив’язана до кампанії;
  - `campaign session`, якщо має `campaignId`.

Супутні домени:

- `User` — акаунт користувача.
- `CampaignMember` — членство в кампанії.
- `SessionParticipant` — участь у конкретній сесії.
- `JoinRequest` — заявка на вступ у кампанію.
- `ChatMessage` — повідомлення в чаті сесії.
- `RefreshToken`, `EmailVerificationToken`, `EmailChangeToken` — безпекові токени.
- `Wallet`, `Transaction`, `UserStats` — фінансово-статистичний контур.

---

## 3. Технологічний Стек

### Frontend

- `React 19`
- `Vite 7`
- `react-router-dom 7`
- `@tanstack/react-query 5`
- `Zustand 5`
- `React Hook Form 7`
- `Axios`
- `react-easy-crop` (avatar crop flow)
- `Tailwind CSS 4`
- `Vitest 4` + Testing Library

### Backend

- `Node.js 22`
- `Express 5`
- `Prisma 6`
- `PostgreSQL 15`
- `Redis 7`
- `ioredis 5`
- `Joi`
- `JWT`
- `Helmet`
- `Pino`
- `Nodemailer`
- `Multer + Sharp`
- `Node test runner` + `c8`

### Інфраструктура

- `Docker Compose`
- сервіси: `client`, `server`, `db`, `redis`, `adminer`

---

## 4. Система Ролей

### 4.1. Глобальні Ролі Користувача

Глобальна роль зберігається в `User.role`.

| Роль | Значення |
| --- | --- |
| `USER` | звичайний користувач платформи |
| `ADMIN` | адміністратор із доступом до admin-маршрутів та адмін-інтерфейсу |

### 4.2. Ролі В Кампанії

Ролі кампанії зберігаються в `CampaignMember.role`.

| Роль | Основний сенс |
| --- | --- |
| `OWNER` | власник кампанії, повний контроль над кампанією |
| `GM` | майстер кампанії, допомагає керувати кампанією і сесіями |
| `PLAYER` | звичайний учасник кампанії |

Ключова бізнес-ідея:

- кампанія має одного `ownerId`;
- додатково власник також входить до `CampaignMember` як `OWNER`;
- `GM` кампанії може мати розширені права в рамках кампанії, але не підміняє власника;
- `PLAYER` кампанії не має адміністративних прав, але є повноправним членом кампанії.

### 4.3. Ролі В Сесії

Ролі сесії зберігаються в `SessionParticipant.role`.

| Роль | Основний сенс |
| --- | --- |
| `GM` | майстер конкретної сесії |
| `PLAYER` | гравець конкретної сесії |

Окремо від ролі учасника існує:

- `Session.ownerId` — технічний власник сесії, тобто користувач, який її створив.

Це важливо, бо:

- `owner session` не завжди тотожний `GM session`;
- у one-shot сесії власник може створити гру без ролі GM;
- в campaign session член кампанії не стає автоматично учасником сесії;
- `campaign member` і `session participant` — різні стани.

### 4.4. Спеціальні Поняття Доступу

У коді важливо розрізняти:

- `campaign member` — користувач входить до складу кампанії;
- `session participant` — користувач уже є в `SessionParticipant`;
- `session owner` — користувач створив сесію;
- `campaign owner override` — власник кампанії має окремі сильні права над сесіями всередині кампанії.

---

## 5. Система Статусів

### 5.1. Статуси Кампанії

Зберігаються в `Campaign.status`.

| Статус | Значення |
| --- | --- |
| `ACTIVE` | кампанія активна |
| `FINISHED` | кампанія завершена |

Стан `FINISHED` є фінальним для більшості сценаріїв:

- не можна редагувати звичайні налаштування завершеної кампанії;
- не можна подавати нові заявки на вступ;
- пов’язані сесії фіналізуються або скасовуються бізнес-логікою сервера.

### 5.2. Статуси Сесії

Зберігаються в `Session.status`.

| Статус | Значення |
| --- | --- |
| `PLANNED` | сесію заплановано |
| `ACTIVE` | гра триває |
| `FINISHED` | гра завершена |
| `CANCELED` | гру скасовано |

Основні переходи:

- `PLANNED -> ACTIVE`
- `PLANNED -> FINISHED`
- `PLANNED -> CANCELED`
- `ACTIVE -> FINISHED`
- `ACTIVE -> CANCELED`

Загальна логіка:

- запустити сесію може підтверджений `GM`;
- завершити сесію може підтверджений `GM`;
- скасувати активну сесію може підтверджений `GM`, власник сесії або owner кампанії;
- скасувати заплановану сесію може власник сесії або owner кампанії.

### 5.3. Статуси Учасника Сесії

Зберігаються в `SessionParticipant.status`.

| Статус | Значення |
| --- | --- |
| `PENDING` | заявка подана, ще не підтверджена |
| `CONFIRMED` | участь підтверджена |
| `DECLINED` | логічний стан відхилення заявки |

Практична особливість:

- у коді відхилення часто означає не оновлення запису на `DECLINED`, а видалення pending-заявки;
- `DECLINED` використовується радше як transport/result state, ніж як стабільний бізнес-стан.

### 5.4. Статуси Join Request Для Кампанії

Зберігаються в `JoinRequest.status`.

| Статус | Значення |
| --- | --- |
| `PENDING` | заявка очікує розгляду |
| `APPROVED` | заявка схвалена |
| `REJECTED` | заявка відхилена |

---

## 6. Система Доступності Та Видимості

### 6.1. Видимість Кампаній

В `CampaignVisibility` зараз існують лише:

| Visibility | Значення |
| --- | --- |
| `PUBLIC` | кампанія видима напряму |
| `LINK_ONLY` | кампанія доступна лише за share link |

`PRIVATE` для кампаній у поточній Prisma-схемі відсутній.

### 6.2. Видимість Сесій

В `SessionVisibility` існують:

| Visibility | Значення |
| --- | --- |
| `PUBLIC` | сесія видима напряму |
| `PRIVATE` | доступ залежить від правил домену |
| `LINK_ONLY` | доступ тільки через share link або через entitlement |

### 6.3. Доменна Модель Доступу

Система доступу будується через:

- `server/src/domain/access/access-rules.js`
- `server/src/domain/campaign/campaign-access.context.js`
- `server/src/domain/campaign/campaign.policy.js`
- `server/src/domain/session/session-access.context.js`
- `server/src/domain/session/session.policy.js`

На сервері доступ розраховується через контекст:

- чи є користувач owner;
- чи є користувач campaign member;
- чи є користувач session participant;
- чи є валідний share token;
- чи є сесія one-shot або campaign session.

### 6.4. Join Mode

Внутрішня модель join-flow використовує такі режими:

| Join Mode | Значення |
| --- | --- |
| `OPEN` | користувач може вступити без додаткового membership gate |
| `REQUEST` | користувач подає заявку або pending-вступ |
| `MEMBERS_ONLY` | вступ дозволений тільки членам кампанії |
| `NOT_APPLICABLE` | join-flow не застосовується |

### 6.5. Матриця Доступу До Кампаній

| Ресурс | Visibility | Outsider discover | Outsider open | Join mode |
| --- | --- | --- | --- | --- |
| Campaign | `PUBLIC` | так | так | `REQUEST` |
| Campaign | `LINK_ONLY` | ні | тільки через share link | `REQUEST` |

### 6.6. Матриця Доступу До One-shot Сесій

| Ресурс | Visibility | Outsider discover | Outsider open | Join mode |
| --- | --- | --- | --- | --- |
| One-shot | `PUBLIC` | так | так | `OPEN` |
| One-shot | `PRIVATE` | так | так | `REQUEST` |
| One-shot | `LINK_ONLY` | ні | тільки через share link | `REQUEST` |

### 6.7. Матриця Доступу До Campaign Session

| Ресурс | Visibility | Outsider discover | Outsider open | Join mode |
| --- | --- | --- | --- | --- |
| Campaign session | `PUBLIC` | так | так | `REQUEST` |
| Campaign session | `PRIVATE` | ні | ні | `MEMBERS_ONLY` |

На практиці це означає:

- outsider не може навіть відкрити `PRIVATE` сесію кампанії;
- член кампанії може її відкрити;
- але член кампанії не вважається автоматично учасником цієї сесії;
- він повинен окремо вступити у сесію;
- після вступу в campaign private session такий учасник підтверджується одразу.

### 6.8. Share Link Модель

Для `LINK_ONLY` кампаній і сесій використовується не простий публічний код, а пара полів:

- `shareTokenHash`
- `shareTokenEncrypted`

Призначення:

- `hash` використовується для пошуку/валідації токена;
- `encrypted` використовується для відновлення raw token, коли власнику треба показати або скопіювати посилання;
- `shareTokenCreatedAt` зберігає момент генерації токена.

Це стосується:

- `Campaign.shareTokenHash`, `Campaign.shareTokenEncrypted`, `Campaign.shareTokenCreatedAt`
- `Session.shareTokenHash`, `Session.shareTokenEncrypted`, `Session.shareTokenCreatedAt`

---

## 7. Правила Вступу В Кампанії Та Сесії

### 7.1. Вступ До Кампанії

Механіка кампаній базується на `JoinRequest`.

Типовий флоу:

1. outsider бачить `PUBLIC` або `LINK_ONLY` кампанію;
2. надсилає join request;
3. owner або GM кампанії розглядає заявку;
4. після approve створюється `CampaignMember`.

### 7.2. Вступ До One-shot Сесії

Основні правила:

- `PUBLIC one-shot`:
  - join-mode `OPEN`;
  - гравець заходить одразу;
  - статус участі зазвичай `CONFIRMED`.
- `PRIVATE one-shot`:
  - join-mode `REQUEST`;
  - гравець подає заявку;
  - статус участі — `PENDING`.
- `LINK_ONLY one-shot`:
  - direct open тільки через share link;
  - далі join-flow поводиться як request/open залежно від конкретного кейсу доступу.

### 7.3. Вступ До Campaign Session

#### `PRIVATE campaign session`

- outsider не може відкрити сесію;
- campaign member може відкрити сесію;
- campaign member може вступити до сесії;
- при вступі статус одразу `CONFIRMED`;
- outsider не може вступити взагалі.

#### `PUBLIC campaign session`

- outsider може відкрити сесію;
- outsider може подати вступ;
- outsider в такому випадку входить як `guest` (`isGuest = true`) і зазвичай має `PENDING`;
- campaign member також може вступити, але не є `guest`.

### 7.4. Вступ Як GM

Для ролі `GM` діють окремі правила:

- якщо в сесії вже є confirmed GM, новий GM-вступ забороняється;
- підтверджувати GM-заявки зазвичай може лише owner сесії;
- після підтвердження одного GM інші pending GM-заявки чистяться.

### 7.5. Важливий Доменно-Архітектурний Принцип

У системі є три різні рівні приналежності:

- користувач платформи;
- член кампанії;
- учасник конкретної сесії.

Ці рівні не можна змішувати.

Правильна семантика:

- `campaign member` дає право бачити частину campaign session;
- але не дає автоматичний запис у `SessionParticipant`;
- `session participant` з’являється тільки після явного join-flow.

---

## 8. Prisma Схема

Файл схеми:

- `server/prisma/schema.prisma`

### 8.1. Основні Моделі

#### `User`

Головна модель акаунта:

- email, username, password;
- глобальна роль `USER` / `ADMIN`;
- profile fields: avatarUrl, displayName, bio, timezone, language;
- email verification state;
- soft-delete прапорець `isDeleted`;
- зв’язки з кампаніями, сесіями, токенами, повідомленнями.

#### `Campaign`

Модель кампанії:

- title, description, imageUrl, system;
- status: `ACTIVE` / `FINISHED`;
- visibility: `PUBLIC` / `LINK_ONLY`;
- ownerId;
- invite/share дані;
- зв’язки: `members`, `sessions`, `joinRequests`.

Примітка:

- поле `inviteCode` ще присутнє в схемі, але основна актуальна модель доступу для `LINK_ONLY` уже спирається на `shareTokenHash` + `shareTokenEncrypted`.

#### `CampaignMember`

Pivot-таблиця між `User` і `Campaign`:

- `role`
- `joinedAt`
- унікальність по `(userId, campaignId)`

#### `Session`

Модель окремої гри:

- title, description, date, duration;
- status: `PLANNED`, `ACTIVE`, `FINISHED`, `CANCELED`;
- visibility: `PUBLIC`, `PRIVATE`, `LINK_ONLY`;
- price, maxPlayers, system;
- може бути пов’язана з кампанією або бути one-shot;
- ownerId;
- зв’язки: `participants`, `messages`.

#### `SessionParticipant`

Pivot-таблиця між `User` і `Session`:

- `role`: `GM` / `PLAYER`
- `status`: `PENDING` / `CONFIRMED` / `DECLINED`
- `isGuest`
- унікальність по `(userId, sessionId)`

#### `JoinRequest`

Заявка на вступ у кампанію:

- `status`
- `message`
- хто подав;
- до якої кампанії;
- ким і коли розглянута.

#### `ChatMessage`

Повідомлення чату сесії:

- `text`
- `userId`
- `sessionId`

#### `Wallet`, `Transaction`, `UserStats`

Підготовчий фінансово-аналітичний шар:

- баланс;
- транзакції;
- кількість зіграних сесій;
- кількість годин.

#### Токен-моделі

- `RefreshToken`
- `EmailVerificationToken`
- `EmailChangeToken`

Вони відповідають за:

- refresh-auth lifecycle;
- verification email;
- change email flow.

### 8.2. Основні Enum-Типи Prisma

#### Глобальні

- `UserRole`: `USER`, `ADMIN`

#### Кампанії

- `CampaignStatus`: `ACTIVE`, `FINISHED`
- `CampaignVisibility`: `PUBLIC`, `LINK_ONLY`
- `CampaignRole`: `OWNER`, `GM`, `PLAYER`

#### Сесії

- `SessionStatus`: `PLANNED`, `ACTIVE`, `FINISHED`, `CANCELED`
- `SessionVisibility`: `PUBLIC`, `PRIVATE`, `LINK_ONLY`
- `SessionRole`: `GM`, `PLAYER`
- `ParticipantStatus`: `PENDING`, `CONFIRMED`, `DECLINED`

#### Join Requests

- `JoinRequestStatus`: `PENDING`, `APPROVED`, `REJECTED`

### 8.3. Ключові Зв’язки

- `User 1 -> N Campaign` через `Campaign.ownerId`
- `User M <-> N Campaign` через `CampaignMember`
- `Campaign 1 -> N Session`
- `User 1 -> N Session` через `Session.ownerId`
- `User M <-> N Session` через `SessionParticipant`
- `Campaign 1 -> N JoinRequest`
- `Session 1 -> N ChatMessage`

---

## 9. Архітектурна Структура Проєкту

## 9.1. Корінь Репозиторію

```text
client/              SPA-клієнт
server/              REST API
docs/                внутрішня документація
docker-compose.yml   локальна інфраструктура
package-lock.json    єдиний lock-файл npm (root-only)
package.json         кореневий workspace-маніфест
.env                 робочі змінні середовища
.env.example         приклад конфігурації
```

## 9.2. Структура Client

```text
client/src/
  assets/
  components/
    layout/
    shared/
    ui/
  constants/
  features/
    admin/
    auth/
    campaigns/
    dashboard/
    profile/
    search/
    security/
    sessions/
  hooks/
  lib/
  routes/
  stores/
  utils/
```

### Що Де Живе На Клієнті

#### `features/`

Feature-first організація UI та логіки:

- `auth/` — login, register, password reset, email verify;
- `campaigns/` — сторінка кампанії, віджети, hooks, API-клієнт;
- `sessions/` — сторінка сесії, preview/full-mode, participants/settings/share-link;
- `dashboard/` — календар, домашній екран, списки сесій і кампаній;
- `profile/` — профілі, avatar upload + crop flow;
- `security/` — password/email/account security flows;
- `admin/` — адмінка;
- `search/` — фільтри і пошук.

#### `components/`

Спільний UI:

- `layout/` — каркаси сторінок;
- `shared/` — загальні компоненти, що знають про бізнес-контекст;
- `ui/` — атомарні та базові візуальні компоненти.

#### `stores/`

Глобальний client state:

- `useAuthStore.js` — авторизація і поточний користувач;
- `useDashboardStore.js` — стан dashboard;
- `useSearchStore.js` — стан пошуку;
- `useToastStore.js` — тости;
- `appSessionManager.js` — централізований reset state + query cache при logout або зміні акаунта.

#### `lib/`

Інфраструктурний клієнтський шар:

- `axios.js` — API client, interceptors, auth/session recovery;
- `queryClient.js` — централізований React Query client.

#### `routes/`

- `AppRoutes.jsx`
- `ProtectedRoute.jsx`
- `AdminRoute.jsx`

## 9.3. Структура Server

```text
server/src/
  config/
  constants/
  controllers/
    session/
  domain/
    access/
    campaign/
    session/
  lib/
  middlewares/
  routes/
  services/
    auth/
    campaign/
    email/
    session/
  startup/
  store/
  utils/
  validation/
    session/
```

### Що Де Живе На Сервері

#### `routes/`

Маршрути верхнього рівня:

- `auth.routes.js`
- `profile.routes.js`
- `campaign.routes.js`
- `session.routes.js`
- `search.routes.js`
- `security.routes.js`
- `admin.routes.js`
- `client-logs.routes.js`

#### `controllers/`

Контролери тонкі: приймають HTTP-запит, викликають сервіс, повертають response.

Актуальні top-level контролери:

- `auth.controller.js`
- `profile.controller.js`
- `security.controller.js`
- `admin.controller.js`
- `campaign.controller.js`
- `search.controller.js`
- `client-logs.controller.js`

Сесії вже частково розкладені за підмодулями:

- `session/session-crud.controller.js`
- `session/session-participants.controller.js`
- `session/session-calendar.controller.js`

#### `services/`

Основний бізнес-шар.

Ключова структура:

- `auth/` — підсервіси автентифікації;
- `campaign/` — membership і permission helpers кампаній;
- `session/` — lifecycle, participants, calendar, query, permissions;
- `email/` — transporter, renderer, шаблони.

На верхньому рівні є facade-сервіси:

- `auth.service.js`
- `campaign.service.js`
- `session.service.js`

Додаткові інфраструктурні/прикладні сервіси:

- `search.service.js`
- `profile.service.js`
- `security.service.js`
- `admin.service.js`
- `upload.service.js`
- `rate-limit.service.js`
- `token-cleanup.service.js`
- `session-cleanup.service.js`
- `email.service.js`

#### `domain/`

Тут живе предметна логіка доступів:

- `access/` — загальні access-rules;
- `campaign/` — campaign context + campaign policy;
- `session/` — session context + session policy.

Саме цей шар відповідає на питання:

- чи може користувач discover/open ресурс;
- який joinMode застосовується;
- чи потрібен share token outsider-у.

#### `middlewares/`

- `auth.middleware.js`
- `admin.middleware.js`
- `csrf.middleware.js`
- `rateLimit.middleware.js`
- `session-access.middleware.js`
- `validation.middleware.js`
- `error.middleware.js`

#### `validation/`

Joi-схеми для route-level validation.

#### `lib/`

Інфраструктурні адаптери:

- `prisma.js`
- `redis.js`
- `logger.js`

#### `store/`

Службові state-like сховища поверх Redis.

Приклад:

- `deletedUsers.js` — blacklist/marker для видалених акаунтів.

#### `startup/`

Серверна ініціалізація:

- `cors.js`
- `static.js`
- `cleanup.js`
- `migrations.js`
- `index.js`

---

## 10. Архітектурний Потік Запиту

Типовий HTTP flow на сервері:

1. `route`
2. `middlewares`
3. `validation`
4. `controller`
5. `service`
6. `domain policy/helpers`
7. `Prisma / Redis / email / upload`
8. `response`

Практичне уточнення по API-префіксах:

- сервер реєструє обидва префікси: `/api/v1` та legacy `/api`;
- це зроблено через єдину функцію реєстрації route-group, тож набір endpoint-ів однаковий для обох префіксів.

На клієнті типовий flow:

1. `page`
2. `controller hook`
3. `feature query/mutation hook`
4. `axios client`
5. `API`
6. `React Query cache / Zustand store`
7. `widgets/components`

---

## 11. Інфраструктура Та Runtime

### 11.0. Dependency Strategy (Root-Only Workspaces)

Поточна конфігурація npm у проєкті:

- використовується root-only модель для workspaces;
- lock-файл лише один: `package-lock.json` у корені;
- інсталяція залежностей у CI та локально виконується з кореня (`npm ci`);
- workspace-скрипти запускаються через кореневі scripts (`build:client`, `lint:server`, `test:coverage:client` тощо).

Практичний наслідок:

- `client/package-lock.json` та `server/package-lock.json` не є частиною актуальної конфігурації.

`docker-compose.yml` описує:

- `db` — PostgreSQL
- `redis` — Redis
- `server` — Express API
- `client` — Vite frontend
- `adminer` — optional debug UI для БД

Важливі runtime-аспекти:

- server залежить від `DATABASE_URL` і `REDIS_URL`;
- при старті можуть запускатися міграції;
- uploads зберігаються у volume;
- Redis використовується не тільки для rate-limit, а й для security-сценаріїв;
- startup додає явне очікування готовності Redis перед повноцінним стартом API;
- health endpoint повертає `degraded` (`503`), якщо Redis не ready;
- у Redis-шарі є tracking деградації та circuit-breaker вікно для повторних помилок.
- `docker-compose` має `healthcheck` для `db` і `redis`, а `server` стартує тільки після їх готовності.

### 11.1. Як Правильно Застосовувати Prisma Міграції На Платформі

Короткий принцип:

- міграції в цій платформі треба застосовувати з контейнера `server`, а не з хоста;
- перед застосуванням міграцій потрібно переконатися, що образ `server` зібрано з актуальними файлами `prisma/migrations`;
- якщо була невдала спроба, спочатку відновлюємо state через `migrate resolve`, потім повторюємо `migrate deploy`.

#### Стандартний безпечний сценарій (після додавання нової міграції)

1. Переконатися, що SQL міграції коректний (особливо `DROP INDEX` vs `DROP CONSTRAINT` для PostgreSQL).
2. Перебудувати образ бекенду, щоб контейнер точно бачив нову/виправлену міграцію:

```bash
docker compose build server
```

3. Застосувати міграції з одноразового контейнера `server`:

```bash
docker compose run --rm server npx prisma migrate deploy
```

4. Перевірити статус:

```bash
docker compose run --rm server npx prisma migrate status
```

Очікуваний результат: `No pending migrations to apply` або повідомлення, що остання міграція щойно успішно застосована.

#### Що робити, якщо отримали `P3009` / `P3018`

Це означає, що в `_prisma_migrations` є запис про невдалу міграцію, і Prisma блокує наступні.

1. Спочатку виправити SQL у відповідній міграції.
2. Перебудувати образ `server`:

```bash
docker compose build server
```

3. Позначити невдалу міграцію як rollback у Prisma metadata:

```bash
docker compose run --rm server npx prisma migrate resolve --rolled-back "<migration_name>"
```

4. Повторно застосувати:

```bash
docker compose run --rm server npx prisma migrate deploy
```

5. Перевірити статус і факт зміни схеми (за потреби через SQL у контейнері `db`).

#### Важливі практичні зауваження

- Не запускати `npx prisma migrate deploy` з хоста проти `db:5432`: ім'я `db` резолвиться всередині Docker-мережі, не у хості.
- У цьому проєкті `server` не монтує весь код як bind volume у `docker-compose`, тому зміни у `prisma/migrations` не потрапляють у вже зібраний образ автоматично.
- Якщо `RUN_MIGRATIONS=true`, сервер також виконує `migrate deploy` на старті. Рекомендовано спочатку прогнати міграції вручну (кроки вище), а вже потім піднімати `server` у звичайному режимі.

#### Мінімальний командний чек-ліст

```bash
docker compose build server
docker compose run --rm server npx prisma migrate deploy
docker compose run --rm server npx prisma migrate status
docker compose up -d server
docker compose logs --tail=120 server
```

---

## 12. Безпека

У проєкті вже закладені:

- cookie-based auth;
- refresh token lifecycle;
- CSRF через double-submit cookie;
- email verification;
- email change confirmation;
- password reset;
- soft delete акаунта;
- blacklist deleted users;
- rate limiting;
- fail-closed поведінка для security-critical сценаріїв при недоступності Redis;
- session recovery та auth-expired handling на клієнті.

---

## 13. Важливі Бізнес-Правила, Які Варто Пам’ятати

- `Campaign member` не дорівнює `Session participant`.
- `Session owner` не завжди дорівнює `Session GM`.
- `Campaign owner` має override-права над сесіями цієї кампанії.
- `LINK_ONLY` доступ працює через share tokens, а не через прості invite codes.
- `CampaignVisibility` зараз не має `PRIVATE` у Prisma-схемі.
- `SessionVisibility` має `PRIVATE`, і саме там найбільше бізнес-логіки доступу.
- `MEMBERS_ONLY` для private campaign session означає: сесію можуть відкривати і join-итись лише члени кампанії.
- outsider у public campaign session може бути `guest`.
- share-link логіка є окремим read/write контуром і на клієнті, і на сервері.

---

## 14. Що Ще Варто Дивитися Поруч

Пов’язані документи:

- `docs/legacy/architecture-roadmap.md`
- `docs/plans/practical-architecture-strategy.md`

Пов’язані технічні точки в коді:

- `server/prisma/schema.prisma`
- `server/src/domain/access/access-rules.js`
- `server/src/domain/campaign/campaign.policy.js`
- `server/src/domain/session/session.policy.js`
- `client/src/features/campaigns/hooks/useCampaignPageController.js`
- `client/src/features/sessions/hooks/useSessionPageController.js`
- `client/src/features/dashboard/hooks/useCalendarQueries.js`

---

## 15. Коротке Резюме

`TTRPG Platform` — це рольово-орієнтована система з двома головними доменами: кампанії та сесії. Її складність не в CRUD як такому, а в правильній моделі доступу:

- хто бачить ресурс;
- хто може в нього вступити;
- хто керує статусами;
- де закінчується membership кампанії і починається participation у сесії.

Архітектурно проєкт уже рухається в правильний бік:

- feature-first на клієнті;
- service/domain split на сервері;
- окремий policy-layer для доступів;
- Prisma як центральна модель даних;
- React Query + Zustand як поєднання серверного і клієнтського стану.

Для подальшого розвитку критичними залишаються саме консистентність доступів, join-flow та синхронізація UI з доменною моделлю сервера.
