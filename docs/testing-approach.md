# Testing Approach — TTRPG Platform

> Документ описує стратегію, правила та пріоритети автоматизованого тестування проекту.
> Всі нові тести мають відповідати цим вимогам. Існуючі тести мігруються при рефакторингу.

---

## 1. Загальний принцип

Перед написанням будь-якого тесту — одне питання:

> Якщо цей код зламається в продакшні, який рівень це виявить першим і з найменшою ціною?

- Логіка без залежностей → **юніт**
- Шари правильні але не з'єднані → **інтеграційний**
- Важливо що користувач бачить і куди потрапляє → **E2E**

Тест на нижчому рівні завжди кращий за тест на вищому якщо покриває те саме.

---

## 2. Піраміда тестування

```
        [ E2E ]          ← мало, тільки критичні флоу
     [ Інтеграційні ]    ← середньо, service + реальна БД
   [    Юніт-тести    ]  ← багато, domain + utils + UI логіка
```

Співвідношення по кількості приблизно: **70% юніт / 20% інтеграційні / 10% E2E**.

---

## 3. Юніт-тести

### Інструменти
- **Server:** Node.js test runner (`node:test` + `node:assert/strict`)
- **Client:** Vitest + Testing Library

### Що тестувати
| Модуль | Приклади |
|--------|---------|
| `domain/access/access-rules.js` | `canDiscoverCampaign`, `canOpenSession`, `getSessionJoinMode` |
| `domain/campaign/campaign.policy.js` | `getJoinMode` для всіх visibility + isCampaignSession комбінацій |
| `domain/session/session.policy.js` | переходи статусів, хто може скасувати/запустити |
| `services/session/session-permission.helpers.js` | `_getConfirmedGm`, `_canChangeSessionStatus`, `_requireSessionOwner` |
| `validation/` (Joi схеми) | невалідний вхід → правильний код помилки |
| React компоненти / хуки | форми, стани завантаження, обробка помилок з мок-даними |

### Що не тестувати юнітами
- Будь-що що реально звертається до Prisma, Redis, Nodemailer
- Логіку яка залежить від стану кількох таблиць одночасно
- HTTP заголовки, CORS, cookies

### Правила написання

**Структура:**
```js
test('повертає MEMBERS_ONLY для PRIVATE campaign session', () => {
  const result = getSessionJoinMode({
    visibility: 'PRIVATE',
    isCampaignSession: true,
  });
  assert.equal(result, JOIN_MODES.MEMBERS_ONLY);
});
```

- Назва тесту = специфікація бізнес-правила, читається без коду
- Назва і assertion завжди збігаються — якщо назва каже "returns false", assert перевіряє `false`
- Один тест — одне твердження (або кілька пов'язаних assertions на один сценарій)
- Якщо мокуєш — мокується тільки зовнішня залежність, але не логіка модуля що тестується
- Ніколи не дублюй логіку реального коду в моку

**Обов'язкові edge cases:**
- `null` і `undefined` для всіх вхідних параметрів
- Порожній масив (`participants: []`)
- Невалідне значення enum (`visibility: 'INVALID'`)
- Граничні комбінації флагів (`isOwner: true, isParticipant: true` одночасно)

**Перевірка якості:**
- Тест має ставати червоним якщо видалити або зламати реальну імплементацію
- Час виконання одного тесту — мілісекунди, всього suite — секунди
- Для запуску не потрібен Docker

### Червоні прапорці
- Тест завжди зелений незалежно від імплементації
- `buildPermissionHelpers` або інший мок дублює реальну логіку
- Для запуску потрібен Docker або мережа

---

## 4. Інтеграційні тести

### Інструменти
- Node.js test runner + реальна тестова PostgreSQL + реальний Redis (або `ioredis-mock` для ізольованих сценаріїв)
- Docker Compose `test` профіль з окремою БД

### Що тестувати
| Сервіс | Сценарії |
|--------|---------|
| `auth.service.js` | реєстрація → токен у БД, refresh-ротація інвалідує старий, soft-delete блокує логін |
| `campaign.service.js` | створення → автоматично CampaignMember OWNER, завершення → PLANNED сесії стають CANCELED |
| `session.service.js` | GM запускає → статус ACTIVE в БД, campaign member в PRIVATE session підтверджується автоматично |
| join-flow | PENDING → APPROVED → CampaignMember створено, відхилення → запис видалено |
| `rate-limit.service.js` | перевищення ліміту → 429, Redis деградує → fail-closed |

### Що не тестувати інтеграційними
- Чисту логіку без БД — це юніт
- HTTP шар, middleware, заголовки — для цього є E2E або окремі middleware тести
- UI поведінку

### Правила написання

**Структура:**
```js
test('approve JoinRequest створює CampaignMember з роллю PLAYER', async () => {
  // arrange — реальні записи в тестовій БД
  const user = await createTestUser();
  const campaign = await createTestCampaign({ ownerId: owner.id });
  const joinRequest = await createJoinRequest({ userId: user.id, campaignId: campaign.id });

  // act
  await campaignService.approveJoinRequest(joinRequest.id, owner.id);

  // assert — перевіряємо стан БД напряму
  const member = await prisma.campaignMember.findFirst({
    where: { userId: user.id, campaignId: campaign.id },
  });
  assert.ok(member);
  assert.equal(member.role, 'PLAYER');
});
```

- `beforeEach` або транзакція з відкатом забезпечує чистий стан БД перед кожним тестом
- Перевіряти стан БД після операції через прямий Prisma запит, не через повернене значення сервісу
- Тест покриває повний бізнес-сценарій з перевіркою побічних ефектів
- Мокується тільки те що принципово недоступно локально (реальний SMTP → Nodemailer мок)
- Redis підіймається реальний якщо тестується rate-limit або security сценарій

**Перевірка якості:**
- Тест стає червоним якщо прибрати запис у БД або транзакцію в сервісі
- Для запуску потрібен Docker — це нормально і очікувано
- Час виконання — секунди на тест

### Червоні прапорці
- Мокується Prisma замість реальної БД
- Тест проходить навіть якщо в БД нічого не записалось
- Немає cleanup між тестами і порядок запуску впливає на результат

---

## 5. E2E тести

### Інструменти
- **Browser flows:** Playwright
- **HTTP flows:** Supertest (для API-рівня без браузера)

### Що тестувати
| Сценарій | Інструмент | Пріоритет |
|----------|-----------|-----------|
| Логін → редирект на dashboard, захист роуту | Playwright | Високий |
| Логін з невірним паролем → залишаємось на /login | Playwright | Високий |
| Видалення акаунту → редирект на /login | Playwright | Високий |
| Share-link доступ: без токена 403, з токеном 200 | Supertest | Високий |
| Campaign member vs session participant розмежування | Supertest | Високий |
| GM бачить кнопки управління, PLAYER — ні | Playwright | Середній |
| Join flow: подача заявки → статус в UI | Playwright | Середній |
| Owner завершує кампанію → статус змінюється в UI | Playwright | Середній |

### Що не тестувати E2E
- Валідація форм (`required`, формат email) → юніт з Testing Library
- Серверні помилки типу "дублікат email" → юніт з мок-мутацією React Query
- Навігація по посиланнях без бізнес-логіки → не тестувати взагалі
- Будь-що що покривається на нижчому рівні

### Правила написання

**Порядок моків — завжди до навігації:**
```js
// ПРАВИЛЬНО
await page.route('**/api/auth/login', async (route) => { ... });
await page.goto(`${baseURL}/login`);

// НЕПРАВИЛЬНО
await page.goto(`${baseURL}/login`);
await page.route('**/api/auth/login', async (route) => { ... }); // запит вже пішов
```

**Перевірка запиту — через waitForRequest:**
```js
// ПРАВИЛЬНО
const [request] = await Promise.all([
  page.waitForRequest('**/api/auth/login'),
  page.getByRole('button', { name: 'Увійти' }).click(),
]);
expect(request.method()).toBe('POST');

// НЕПРАВИЛЬНО
await page.route('**/api/auth/login', async (route) => {
  expect(route.request().method()).toBe('POST'); // може не прокинути помилку в тест
});
```

**Локатори — прив'язані до того що бачить користувач:**
```js
// ПРАВИЛЬНО
page.getByRole('button', { name: 'Увійти' })
page.getByLabel('Email')
page.getByPlaceholder('Пароль')
page.getByRole('heading', { name: 'Безпека акаунту' })

// НЕПРАВИЛЬНО
page.locator('#submit-btn')
page.locator('.form-input')
page.getByText('testuser').nth(1)
```

**Структура тесту:**
```js
test('логін і захист роуту для авторизованого юзера', async ({ page, baseURL }, testInfo) => {
  await test.step('відкриваємо сторінку логіну', async () => { ... });
  await test.step('заповнюємо і сабмітимо форму', async () => { ... });
  await test.step('перевіряємо редирект на dashboard', async () => { ... });
  await test.step('авторизований юзер не потрапляє на /login', async () => { ... });
});
```

- `captureStep` після кожного значущого кроку
- Кожен тест незалежний — не покладається на стан попереднього
- Один тест — один користувацький сценарій
- Глобальні моки (csrf-token, profile/me) — в `beforeEach`
- Специфічні моки (помилка сервера, конкретна відповідь) — всередині тесту, до навігації

**Перевірка якості:**
- Тест стає червоним якщо замокати відповідь з помилкою замість успіху
- Немає порожніх `test.step` з коментарем "requires real backend"
- Форма не сабмітується двічі

### Червоні прапорці
- `expect` всередині `route.fulfill` handler
- Мок реєструється після `page.goto`
- Порожній крок який завжди зелений
- Тест перевіряє React Router замість бізнес-логіки
- CORS обхід через ручні `Access-Control-*` заголовки в кожному моку

---

## 6. Пріоритети покриття для TTRPG Platform

### Критичні (покрити першими)

**Юніт:**
- Весь `domain/access/access-rules.js` — матриці доступу
- `campaign.policy.js` і `session.policy.js` — join mode, переходи статусів
- `session-permission.helpers.js` — хто може що робити з сесією

**Інтеграційні:**
- Join-flow кампанії: повний цикл PENDING → APPROVED → CampaignMember
- Session lifecycle: PLANNED → ACTIVE → FINISHED з перевіркою прав
- Auth: реєстрація, refresh-ротація, soft-delete блокує логін

**E2E:**
- Логін + захист роуту
- Видалення акаунту

### Важливі (другий пріоритет)

**Інтеграційні:**
- Campaign member ≠ session participant (вступ у кампанію не дає автоматичної участі в сесії)
- PRIVATE campaign session: member підтверджується автоматично, outsider — PENDING
- Завершення кампанії → PLANNED сесії стають CANCELED

**E2E:**
- Share-link доступ через Supertest
- GM vs PLAYER різниця в UI кнопках

### Нижчий пріоритет

- Фінансовий контур (Wallet, Transaction) — коли буде активно розроблятись
- Admin маршрути
- Search функціональність

---

## 7. Чого не робити (анти-патерни)

| Анти-патерн | Чому погано |
|-------------|------------|
| Мок дублює логіку реального коду | Тест тестує мок, не код |
| `expect` всередині `route` handler | Помилка може не прокинутись в тест |
| Мок після `page.goto` | Запит вже пішов до реєстрації моку |
| Порожній `test.step` що завжди зелений | Хибне відчуття покриття |
| E2E для валідації форм | Платиш ціною браузера за перевірку `required: true` |
| Юніт з моком що дублює імплементацію | При баґу в коді тест залишається зеленим |
| `.nth(n)` локатори | Ламаються при будь-якій зміні верстки |
| Назва тесту суперечить assertion | Хибна документація, невидимий баґ |
| Тести залежать від порядку запуску | Нестабільний suite, важко дебажити |
