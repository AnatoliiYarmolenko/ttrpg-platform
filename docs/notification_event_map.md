# Карта подій та отримувачів сповіщень

> Документ фіксує уніфіковану карту сповіщень для `ttrpg-platform`.
> Мета: не просто перелічити всі можливі події, а визначити стабільні **notification templates**, їхніх отримувачів, рівень важливості, правила антиспаму та можливі deep-link'и.

---

## Принципи карти

### 1. Сповіщення будуються навколо станів, а не навколо кожної дії

Краще:

- “До цієї сесії подано нові заявки”

Гірше:

- “Користувач X подав заявку”
- “Користувач Y подав заявку”
- “Користувач Z подав заявку”

Тобто для менеджерів сутності ми переважно шлемо:

- зведені;
- агреговані;
- уніфіковані повідомлення.

### 2. Одна бізнес-подія може породжувати різні сповіщення для різних ролей

Наприклад, перенесення сесії з конфліктами може дати:

- summary для власника сесії;
- персональне попередження для кожного конфліктного учасника.

### 3. Не кожна подія має ставати окремим notification type

Наприклад:

- `session.deleted`
- `session.canceled`

можуть бути відображені одним user-facing типом:

- `SESSION_CANCELLED`

### 4. Канонічний порядок пріоритету

- спершу визначається **подія**
- потім **кому це важливо**
- потім **чи треба це агрегувати**
- і лише після цього формується текст і посилання

---

## Severity

| Severity | Коли використовувати |
|---|---|
| `INFO` | інформація, яка не вимагає термінової реакції |
| `SUCCESS` | користувача підтверджено або дія успішно завершилась для нього |
| `WARNING` | треба звернути увагу: reminder, конфлікт, ризик автоскасування |
| `ERROR` | користувач втратив участь, доступ або подію скасовано |
| `CRITICAL` | потрібна швидка реакція, бажано окремий toast/priority channel |
| `SECURITY` | події безпеки та доступу |

---

## Групи отримувачів

| Ключ | Хто це |
|---|---|
| `target_user` | конкретний користувач, якого безпосередньо стосується подія |
| `session_owner` | власник сесії |
| `session_managers` | `session_owner` + `CONFIRMED GM`, якщо він має права керування, + `campaign_owner` для campaign-session, де в коді є owner override |
| `session_confirmed_participants` | підтверджені учасники сесії |
| `session_pending_participants` | учасники зі статусом `PENDING` |
| `campaign_owner` | власник кампанії |
| `campaign_managers` | `campaign_owner` + `GM` кампанії |
| `campaign_members` | усі учасники кампанії |
| `platform_admins` | адміністратори платформи |
| `all_users` | глобальний broadcast |

---

## Базові правила антиспаму

- Не сповіщати актора про подію, яку він щойно сам виконав, якщо UI вже показав результат синхронно.
- Для owner/manager inbox не слати окреме повідомлення на кожну однотипну заявку; агрегувати по сутності та короткому вікну.
- Для `update/reschedule` collapse повторних змін у межах 5-10 хвилин в одну нотифікацію.
- Для reminder не слати більше одного повідомлення на один `leadTime` для тієї самої сесії.
- Для conflict-подій слати тільки тим, кого реально зачепило.
- Для видалення/втрати доступу не давати битий link: якщо користувач уже не має доступу до сторінки, вести на fallback сторінку.
- Якщо подія дрібна і не має окремої цінності для користувача, краще зробити її `silent` або залишити тільки в audit/log layer.

---

## Політика deep-link

### Основні шаблони

- сесія: `/session/:id`
- кампанія: `/campaign/:id`
- профіль / безпека: `/?tab=profile&section=security`
- профіль / інтеграції: `/?tab=profile&section=integrations`
- головна: `/`
- адмінка: `/admin`

### Fallback правило

Якщо після події користувач **втрачає доступ** до сутності:

- основний link не ставимо;
- або ставимо fallback на `/`;
- або на пов'язану ще доступну сутність.

---

## Session notifications

| Unified type | Source events | Отримувачі | Severity | Політика | Link | Статус | Опис |
|---|---|---|---|---|---|---|---|
| `SESSION_JOIN_REQUESTS_UPDATED` | `session.join-request.created`, `session.join-request.withdrawn` | `session_managers` | `INFO` | Агрегувати по `sessionId` вікном 10 хв; title: "До сесії \"Назва\" подано нові заявки" | `/session/:id` | ✅ MVP | **Менеджерам сесії:** хтось хоче приєднатися до вашої сесії — потрібно підтвердити заявку |
| `SESSION_PARTICIPANT_JOINED` | `session.participant.confirmed` (auto-confirm) | `session_managers` | `INFO` | Миттєво; title: "До сесії \"Назва\" приєднався новий учасник" | `/session/:id` | ✅ MVP | **Менеджерам сесії:** учасник автоматично приєднався до публічної сесії |
| `SESSION_PARTICIPATION_CONFIRMED` | `session.participant.confirmed`, `session.participant.auto-confirmed` | `target_user` | `SUCCESS` | Миттєво; не слати, якщо actor already sees same success and статус був `CONFIRMED` одразу | `/session/:id` | ✅ MVP | **Учаснику:** вас підтвердили на сесію — ви можете брати участь |
| `SESSION_PARTICIPATION_DECLINED` | `session.participant.declined` | `target_user` | `ERROR` | Миттєво; одна нотифікація на один state change | `/session/:id` або `/` | ❌ NOTIF-024 | **Учаснику:** вашу заявку на сесію відхилили — ви не можете брати участь |
| `SESSION_PARTICIPANT_LEFT` | `session.participant.left` | `session_managers` | `INFO` | Агрегувати по `sessionId` вікном 15 хв; без імен у title | `/session/:id` | 🔄 Future | **Менеджерам:** хтось з учасників самовільно покинув сесію |
| `SESSION_PARTICIPANT_REMOVED` | `session.participant.removed` | `target_user` | `WARNING` | Миттєво; важливо для користувача, бо він втрачає участь | `/session/:id` якщо доступ ще є, інакше `/` | 🔄 Future | **Учаснику:** вас видалили з сесії організатором — ви більше не берете участь |
| `SESSION_GM_REQUEST_PENDING` | `session.gm-request.created` | `session_owner` | `INFO` | Миттєво або агрегувати по `sessionId` 10 хв, якщо заявок кілька | `/session/:id` | 🔄 Future | **Власнику сесії:** хтось хоче стати GM (ігровим майстром) — потрібно схвалити |
| `SESSION_GM_CONFIRMED` | `session.gm.confirmed` | `target_user` | `SUCCESS` | Миттєво; також можна додатково показати `INFO` owner-у тільки якщо він не actor | `/session/:id` | 🔄 Future | **GM:** вас підтвердили як ігрового майстра сесії |
| `SESSION_GM_REMOVED` | `session.gm.removed`, `session.gm.kicked` | `target_user` | `WARNING` | Миттєво; без дубля для owner, якщо owner сам це зробив | `/session/:id` або `/` | 🔄 Future | **GM:** вас зняли з ролі ігрового майстра сесії |
| `SESSION_UPDATED` | `session.updated.general` | `session_confirmed_participants`, `session_owner` | `INFO` | Collapse повторних update у 5 хв; не слати actor-у; використовувати generic title "Параметри сесії оновлено" | `/session/:id` | ❌ NOTIF-025 | **Учасникам:** змінились параметри сесії (не час) — перевірте деталі |
| `SESSION_RESCHEDULED` | `session.rescheduled` | `session_confirmed_participants`, `session_pending_participants`, `session_owner` | `WARNING` | Collapse по `sessionId` у 10 хв; body містить старий і новий час | `/session/:id` | ✅ MVP | **Учасникам:** сесію перенесли на інший час — перевірте новий розклад |
| `SESSION_CANCELLED` | `session.canceled`, `session.deleted` | `session_confirmed_participants`, `session_pending_participants`, `session_owner` | `ERROR` | Єдиний template для cancel/delete; actor-у не дублювати | `/session/:id` якщо ще доступна сторінка, інакше `/campaign/:campaignId` або `/` | ✅ MVP | **Учасникам:** сесію скасовано — вона більше не відбудеться |
| `SESSION_FINISHED` | `session.finished`, `session.auto-finished` | `session_confirmed_participants` | `INFO` | Опційно; за замовчуванням low-priority, без toast; **out of scope для Phase 1-3** | `/session/:id` | 🔄 Future | **Учасникам:** сесію завершено — подяка за участь або підведення підсумків |
| `SESSION_TIME_CONFLICT` | `session.rescheduled.conflict-detected` | `target_user` (тільки конфліктні) | `WARNING` | Миттєво; короткий body: "Перенесено на [час]. У вас вже є сесія на цей час." | `/session/:id` | ✅ MVP | **Конфліктному учаснику:** сесію перенесли на ваш зайнятий час |
| `~SESSION_CONFLICT_REVIEW_REQUIRED~` | ~`session.rescheduled.conflict-detected`~ | — | — | ~Deprecated: замінено на `SESSION_TIME_CONFLICT`~ | — | ❌ Removed | ~Скид в PENDING більше не виконується~ |
| `~SESSION_OWNER_CONFLICT_SUMMARY~` | ~`session.rescheduled.conflict-detected`~ | — | — | ~Deprecated: менеджери більше не отримують цю нотифікацію~ | — | ❌ Removed | ~Користувачі самі вирішують чи лишатися~ |
| `SESSION_REMINDER` | `session.reminder.24h`, `session.reminder.1h`, `session.reminder.15m` | `session_confirmed_participants`, опційно `session_owner` | `INFO` для 24h, `WARNING` для 1h/15m | Дедуп по `sessionId + leadTime + userId`; не слати pending users | `/session/:id` | 🔄 Phase 4 | **Учасникам:** нагадування — сесія скоро почнеться |
| `SESSION_AUTO_CANCEL_WARNING` | `session.warning.auto-cancel-soon`, `session.warning.no-confirmed-gm`, `session.warning.stale-planned` | `session_owner`, опційно `session_managers` | `WARNING` | Не частіше 1 разу на тип warning за 24 год; тільки якщо користувач може вплинути на ситуацію | `/session/:id` | 🔄 Phase 4 | **Організаторам:** сесія може бути автоматично скасована — перевірте умови |
| `SESSION_AUTO_CANCELLED` | `session.auto-canceled` | `session_confirmed_participants`, `session_pending_participants`, `session_owner` | `ERROR` | Миттєво; окремий template від ручного cancel лише якщо важлива причина | `/session/:id` якщо доступно, інакше `/` | 🔄 Future | **Учасникам:** сесію автоматично скасовано системою — деталі в описі |
| `SESSION_CAPACITY_REACHED` | `session.capacity.reached` | `session_owner` | `INFO` | Опційно; одна нотифікація при першому досягненні ліміту, без повторів | `/session/:id` | 🔄 Future | **Організатору:** сесія заповнилась — досягнуто максимальну кількість учасників |
| `SESSION_CAPACITY_AVAILABLE_AGAIN` | `session.capacity.available-again` | `session_owner` | `INFO` | Опційно; слати тільки якщо до цього була подія `CAPACITY_REACHED` | `/session/:id` | 🔄 Future | **Організатору:** з'явилось місце в сесії — хтось відмовився і тепер є слот |

---

## Campaign notifications

| Unified type | Source events | Отримувачі | Severity | Політика | Link | Статус | Опис |
|---|---|---|---|---|---|---|---|
| `CAMPAIGN_INVITATION_PENDING` | `campaign.invitation.created` | `target_user` | `INFO` | Future-ready; окремий template лише якщо в продукті з'явиться справжній invite-flow. У поточному коді його функціональним MVP-еквівалентом є `CAMPAIGN_PARTICIPATION_CONFIRMED` через direct add | `/campaign/:id` | 🔄 Future | **Запрошеному:** вас запросили приєднатися до кампанії — прийміть або відхиліть запрошення |
| `CAMPAIGN_JOIN_REQUESTS_UPDATED` | `campaign.join-request.created`, `campaign.join-request.withdrawn` | `campaign_managers` | `INFO` | Агрегувати по `campaignId` вікном 10 хв; title: "До кампанії \"Назва\" подано нові заявки" | `/campaign/:id` | ✅ MVP | **Менеджерам кампанії:** хтось хоче приєднатися до кампанії — потрібно схвалити заявку |
| `CAMPAIGN_PARTICIPATION_CONFIRMED` | `campaign.join-request.approved`, `campaign.member.added` | `target_user` | `SUCCESS` | Уніфікувати approval та direct add в одне повідомлення: "Вас додано до кампанії" | `/campaign/:id` | ✅ MVP | **Учаснику:** вас додано до кампанії — ви тепер частина групи |
| `CAMPAIGN_PARTICIPATION_DECLINED` | `campaign.join-request.rejected` | `target_user` | `ERROR` | Миттєво; якщо кампанія більше недоступна, вести на `/` | `/campaign/:id` або `/` | ✅ MVP | **Учаснику:** вашу заявку на кампанію відхилили — ви не можете приєднатися |
| `CAMPAIGN_MEMBER_REMOVED` | `campaign.member.removed` | `target_user` | `WARNING` | Миттєво; actor-у не дублювати, якщо це self-leave | `/` | ✅ MVP | **Учаснику:** вас видалили з кампанії організатором — ви більше не маєте доступу |
| `CAMPAIGN_MEMBER_LEFT` | `campaign.member.left` | `campaign_managers` | `INFO` | Агрегувати по `campaignId` вікном 15 хв | `/campaign/:id` | 🔄 Future | **Менеджерам:** учасник самовільно покинув кампанію |
| `CAMPAIGN_ROLE_UPDATED` | `campaign.member.role.updated` | `target_user` | `INFO` | Миттєво; body містить нову роль | `/campaign/:id` | ❌ NOTIF-034 | **Учаснику:** вашу роль в кампанії змінено — перевірте нові права |
| `CAMPAIGN_OWNERSHIP_TRANSFERRED` | `campaign.ownership.transferred` | `target_user` для нового власника, опційно попередній власник | `SUCCESS` для нового власника, `INFO` для попереднього | Не дублювати, якщо це було явно підтверджено в UI actor-ом; для нового власника лишити обов'язково | `/campaign/:id` | 🔄 Future | **Новому власнику:** вам передали право власності на кампанію — ви тепер головний організатор |
| `CAMPAIGN_FINISHED` | `campaign.finished` | `campaign_members` | `INFO` | Надсилається при переході статусу кампанії у `FINISHED`. | `/campaign/:id` | ✅ MVP | **Учасникам:** кампанію завершено |
| `CAMPAIGN_SESSION_PUBLISHED` | `campaign.session.created` | `campaign_members` | `INFO` | Опційно; краще як low-priority event, не слати якщо є окремий widget/list update | `/session/:id` | 🔄 Future | **Учасникам:** в кампанії створено нову сесію — можете приєднатися |
| `CAMPAIGN_SESSION_UPDATED` | `campaign.session.updated`, `campaign.session.rescheduled` | `campaign_members`, яких стосується сесія | `INFO` або `WARNING` | Краще покладатися на session-level templates; campaign-level дубль не робити за замовчуванням | `/session/:id` | 🔄 Future | **Учасникам:** змінилась сесія в кампанії — перевірте деталі |
| `CAMPAIGN_SESSION_CANCELLED` | `campaign.session.canceled` | `campaign_members`, яких стосується сесія | `ERROR` | Також краще не дублювати зверху campaign-level, якщо вже є `SESSION_CANCELLED` | `/session/:id` або `/campaign/:id` | 🔄 Future | **Учасникам:** сесію в кампанії скасовано — вона не відбудеться |

---

## Security та account notifications

| Unified type | Source events | Отримувачі | Severity | Політика | Link | Статус | Опис |
|---|---|---|---|---|---|---|---|
| `SECURITY_PASSWORD_CHANGED` | `security.password.changed` | `target_user` | `SECURITY` | Миттєво; важлива подія; body може містити факт інвалідації сесій | `/?tab=profile&section=security` | 🔄 Phase 4 | **Користувачеві:** пароль змінено — перевірте, що це зробили ви, а не хтось інший |
| `SECURITY_SESSIONS_REVOKED` | `security.sessions.revoked` | `target_user` | `SECURITY` | Не окремий template, якщо вже є `SECURITY_PASSWORD_CHANGED`; краще metadata у тому ж повідомленні | `/?tab=profile&section=security` | 🔄 Phase 4 | **Користувачеві:** сесії в інших браузерах/пристроях завершено — частина зміни пароля |
| `SECURITY_EMAIL_CHANGE_REQUESTED` | `security.email-change.requested` | `target_user` | `SECURITY` | Опційно; за замовчуванням не слати окремо в in-app, бо основний канал тут email | `/?tab=profile&section=security` | 🔄 Future | **Користувачеві:** запитано зміну email — підтвердіть через email-лист |
| `SECURITY_EMAIL_CHANGED` | `security.email.changed` | `target_user` | `SECURITY` | Миттєво; окреме підтвердження після успішної зміни | `/?tab=profile&section=security` | 🔄 Phase 4 | **Користувачеві:** email успішно змінено — перевірте, що це зробили ви |
| `SECURITY_NEW_DEVICE_LOGIN` | `security.new-device-login` | `target_user` | `SECURITY` | Future-ready; слати тільки при надійній device-detection стратегії | `/?tab=profile&section=security` | 🔄 Future | **Користувачеві:** вхід з нового пристрою — якщо це не ви, змініть пароль |
| `SECURITY_SUSPICIOUS_ACTIVITY` | `security.suspicious-activity` | `target_user` | `CRITICAL` | Future-ready; тільки для справді підозрілих кейсів, не для кожного rate-limit hit | `/?tab=profile&section=security` | 🔄 Future | **Користувачеві:** виявлено підозрілу активність — негайно перевірте безпеку акаунта |
| `AUTH_EMAIL_VERIFIED` | `auth.email.verified` | `target_user` | `SUCCESS` | Опційно; одна коротка success-нотифікація після підтвердження email | `/` | 🔄 Future | **Користувачеві:** email підтверджено — ваш акаунт тепер повністю активний |

---

## System та admin notifications

| Unified type | Source events | Отримувачі | Severity | Політика | Link | Статус | Опис |
|---|---|---|---|---|---|---|---|
| `SYSTEM_MAINTENANCE_SCHEDULED` | `system.maintenance.scheduled` | `all_users` | `WARNING` | Broadcast; бажано з `expiresAt`; не більше 1 активної нотифікації на вікно робіт | `/` | 🔄 Future | **Всім:** заплановано технічні роботи — сервіс може бути тимчасово недоступний |
| `SYSTEM_MAINTENANCE_STARTED` | `system.maintenance.started` | `all_users` | `WARNING` | Broadcast only if maintenance affects sessions/actions right now | `/` | 🔄 Future | **Всім:** технічні роботи розпочато — деякі функції тимчасово недоступні |
| `ADMIN_SESSION_REMOVED` | `admin.session.deleted` | користувачі, пов'язані із сесією | `ERROR` | Миттєво; чітко пояснює, що подію прибрано модератором | `/` | 🔄 Future | **Учасникам:** сесію видалено адміністратором — вона порушувала правила платформи |
| `ADMIN_CAMPAIGN_REMOVED` | `admin.campaign.deleted` | власник кампанії та її учасники | `ERROR` | Миттєво; link на `/`, бо campaign page більше не існує | `/` | 🔄 Future | **Учасникам:** кампанію видалено адміністратором — вона порушувала правила платформи |
| `ADMIN_ACCOUNT_NOTICE` | `admin.user.warning`, `admin.user.restriction` | `target_user` | `WARNING` або `CRITICAL` | Future-ready; окремий канал для moderation notices | `/` | 🔄 Future | **Користувачеві:** попередження від адміністрації — перевірте деталі та дотримуйтесь правил |

---

## Події, які не варто робити окремими сповіщеннями за замовчуванням

Ці події можуть існувати в audit/log або в server events, але не повинні автоматично ставати користувацькими нотифікаціями:

- успішний login;
- logout;
- resend verification email;
- forgot password request;
- profile updated;
- avatar changed;
- campaign/share-link regenerated;
- кожен окремий join request поіменно для owner-а;
- кожен дрібний update сесії окремим повідомленням;
- кожен rate-limit hit.

---

## Мінімальний обов'язковий набір для першої реалізації

Якщо треба вибрати найцінніший стартовий набір, то я рекомендую почати з таких unified templates:

### Phase 3

- `SESSION_JOIN_REQUESTS_UPDATED`
- `SESSION_PARTICIPANT_JOINED`
- `SESSION_PARTICIPATION_CONFIRMED`
- `SESSION_PARTICIPATION_DECLINED`
- `SESSION_UPDATED`
- `SESSION_RESCHEDULED`
- `SESSION_TIME_CONFLICT` (замінено `SESSION_CONFLICT_REVIEW_REQUIRED` + `SESSION_OWNER_CONFLICT_SUMMARY`)
- `SESSION_CANCELLED`
- `CAMPAIGN_JOIN_REQUESTS_UPDATED`
- `CAMPAIGN_PARTICIPATION_CONFIRMED`
- `CAMPAIGN_PARTICIPATION_DECLINED`
- `CAMPAIGN_MEMBER_REMOVED`
- `CAMPAIGN_ROLE_UPDATED`
- `CAMPAIGN_FINISHED`

### Phase 4

- `SESSION_REMINDER`
- `SESSION_AUTO_CANCEL_WARNING`
- `SECURITY_PASSWORD_CHANGED`
- `SECURITY_EMAIL_CHANGED`

Цей набір уже покриває:

- заявки;
- участь;
- зміну розкладу;
- конфлікти;
- reminder/lifecycle warning;
- базову безпеку;

і при цьому ще не створює надлишкового шуму.

`SESSION_FINISHED`, `CAMPAIGN_INVITATION_PENDING`, `SECURITY_NEW_DEVICE_LOGIN` та інші future-ready / low-priority templates не входять у Phase 1-3.

---

## Вимоги до даних notification payload

Щоб карта працювала і для in-app, і для майбутнього Telegram, кожна нотифікація повинна вміти нести щонайменше:

- `eventKey`
- `type`
- `severity`
- `title`
- `body`
- `link`
- `linkLabel` опційно
- `source`
- `entityType` (`session`, `campaign`, `security`, `system`)
- `entityId`
- `aggregationKey` опційно
- `metadata`

### Типові metadata-поля

- `sessionId`
- `campaignId`
- `previousDate`
- `newDate`
- `leadTime`
- `conflictCount`
- `pendingCount`
- `role`

---

## Висновок

Ця карта свідомо побудована так, щоб:

- не заспамлювати owner/manager ролі;
- уніфікувати події в стабільні user-facing templates;
- залишати місце для Telegram і інших каналів;
- прив'язувати сповіщення до реальних deep-link'ів проєкту;
- відокремлювати доменні події від текстів та каналів доставки.
