# Backend проверки заёмщика

Модуль `BorrowerVerificationsModule` подключён в `AppModule`. Маршруты ниже относительны backend; внешний nginx добавляет `/api`. Все маршруты требуют `Authorization: Bearer <accessToken>`.

## Что доступно

- Создание проверки до сделки; выбор существующего Party, Borrower или создание нового человека.
- История проверок, фильтры, пагинация и подробная карточка.
- Версии подтверждённых паспортных данных; синхронизация ФИО/ИНН с Party и ФИО с Borrower.
- 19 пунктов чек-листа v1: обязательные и дополнительные проверки, тип результата, ссылки, инструкции, данные для копирования.
- Приватные файлы и ссылки, проверка доказательств, ручные результаты и находки.
- Явное принятие результата, разбор совпадений, риски и устранение.
- Очередь автоматических запусков, worker, lease, тайм-аут, восстановление прерванной обработки и аудит.
- Итоговое решение с проверкой актуальности, роли и неизменности просмотренной карточки; последующие проверки создаются отдельно.

**Ни одного реального автоматического источника пока не подключено.** Реестр адаптеров пуст, `automaticChecks=[]`, `ocrAvailable=false`. Неподключённая проверка не создаёт задачу и не получает фиктивный результат. OCR возвращает 503 `OCR_NOT_CONFIGURED`; паспорт можно ввести вручную. Контракт OCR зарезервирован для следующей интеграции, рабочего OCR-обработчика нет.

## Доступ

VIEWER читает карточки и документы своего workspace. MANAGER редактирует, выполняет проверки и отправляет на рассмотрение. OWNER/ADMIN дополнительно принимают итоговое решение и отмечают дополнительные пункты неприменимыми. Обязательные пункты нельзя пропустить через not-applicable.

Доступ проверяется по активному пользователю и `workspace_members`, не по присланному userId. Чужой workspace/чужая проверка возвращает 404. Каждая вложенная ссылка проверяется на принадлежность родителю. Изменение завершённой/отменённой проверки возвращает 409.

Карточка содержит `allowedActions`, `memberRole`, `capabilities`, `readiness`. Фронт может использовать их для доступности кнопок; сервер независимо проверяет те же полномочия.

## Маршруты

Обозначения: `V=/borrower-verifications/:id`, `I=V/items/:itemId`, `R=I/runs/:runId`.

| Метод | Маршрут | Действие |
| --- | --- | --- |
| POST | `/borrower-verifications` | Создать проверку |
| GET | `/borrower-verifications` | Список: workspaceId, partyId, status, risk, assignedToId, from/to (ISO timestamp), page, limit |
| GET | V | Карточка и принятые результаты |
| PATCH | V | Сменить assignedToId |
| GET | V/readiness | Доступность каждого пункта и недостающие поля |
| POST | V/run | Пакетный запуск доступных автопроверок, 202 |
| POST | V/submit-review | Проверить полноту и отправить на согласование |
| POST | V/complete | Зафиксировать решение |
| POST | V/recheck | Новый эпизод проверки |
| POST | V/cancel | Отменить проверку и активные задачи |
| GET / PUT | V/identity | Получить / подтвердить полную новую версию данных |
| GET | V/identity/history | История подтверждённых версий человека |
| GET | V/items | Пункты и выбранные результаты |
| GET | I | Пункт и готовность |
| GET | I/manual-context | Источник, инструкция, copyFields, previousNames, resultSchema |
| POST / GET | I/runs | Поставить автопроверку в очередь / история запусков |
| GET | R | Результат, находки, доказательства и риски запуска |
| POST | I/manual-results | Записать ручной результат |
| POST | R/accept | Подтвердить и выбрать результат |
| POST | I/not-applicable | Неприменимость дополнительного пункта с reason |
| GET | R/findings | Конкретные дела/производства/совпадения |
| POST | R/findings/:findingId/identity-review | Подтвердить или отклонить совпадение |
| POST / GET | V/evidence | Загрузить файл multipart / список доказательств |
| POST | V/evidence/links | Добавить ссылку |
| GET | V/evidence/:evidenceId | Метаданные и распознавание |
| GET | V/evidence/:evidenceId/content | Скачать приватный файл |
| POST | V/evidence/:evidenceId/review | Проверить подлинность/пригодность доказательства |
| POST | V/evidence/:evidenceId/recognize | Пока 503: OCR не подключён |
| POST / GET | V/risks | Добавить ручной риск / список с фильтрами status, severity |
| PATCH | V/risks/:riskId | assignedToId, dueAt, requiredAction |
| POST | V/risks/:riskId/start-remediation | Взять в работу |
| POST | V/risks/:riskId/resolve | Устранить: comment и evidenceId |
| POST | V/risks/:riskId/dismiss | Отклонить: comment |

## Основной сценарий

Создать проверку:

```json
{"borrowerId":"existing-borrower-id"}
```

Альтернатива: `partyId` или `displayName`. `workspaceId` необязателен: по умолчанию личное рабочее пространство пользователя. `partyId` и `borrowerId` взаимоисключающие. Допустимы `dealId`, `assignedToId`; сделка должна принадлежать тому же workspace и не противоречить выбранному заёмщику.

Подтвердить `PUT V/identity`:

```json
{
  "firstName":"Иван",
  "lastName":"Иванов",
  "middleName":"Иванович",
  "birthDate":"1985-04-15",
  "passportSeries":"4500",
  "passportNumber":"123456",
  "passportIssuedOn":"2005-04-15",
  "passportIssuedBy":"Отдел МВД",
  "passportDepartmentCode":"770-001",
  "registrationAddress":{"region":"Москва","full":"Адрес регистрации"}
}
```

Также поддерживаются `hasNoMiddleName`, `birthPlace`, `residentialAddress`, `previousNames` (ФИО, from/to, reason), `previousRegions`, `inn`, `snils`, `ogrnip`, `sourceDocumentId`. Это полная версия: не переданные необязательные поля не наследуются автоматически. При `sourceDocumentId` паспорт должен быть загружен в эту проверку.

Загрузить файл: multipart `file`, поля `kind`, `title`; необязательные `itemId`, `runId`, `findingId`, `issuedOn`, `capturedAt`, `validUntil`, `sourceUrl`. PDF/PNG/JPEG до 10 МБ; проверяется сигнатура и соответствие MIME. Перед ручным результатом удобно подтвердить исходное доказательство: `POST .../review` с `{"status":"CONFIRMED","comment":"Документ проверен"}`.

Ручной результат: `POST I/manual-results`, обязательный заголовок `Idempotency-Key`:

```json
{
  "resultBoolean":true,
  "evidenceIds":["evidence-id"],
  "summary":"Паспорт проверен по указанному источнику",
  "sourceAsOfAt":"2026-11-13T10:00:00Z"
}
```

Для MONEY — `resultAmount` строкой (`"0.00"`) и `currency`; CATEGORY — `resultCode` из `resultSchema.categories`; RECORD_LIST — `findings` и непустой `coverage`, даже при отсутствии совпадений. Нельзя подменить неизвестность false/нулём. Каждый ручной результат требует доказательства; для документальных пунктов ссылка не заменяет файл.

Сведения finding: findingType, recordKey, title, externalId, referenceNumber, categoryCode, personRole, recordStatus, openedOn/closedOn, claimAmount/outstandingAmount, currency, authorityName, sourceUrl, identityMatch, matchBasis, matchComment, details. По умолчанию `identityMatch=UNKNOWN`: такой результат нельзя принять, пока совпадение не разобрано.

Evidence привязываются к запуску отдельными ссылочными записями: файл не копируется. Если исходный документ ещё не подтверждён, review нужно выполнить для evidence конкретного запуска, возвращённых в его карточке. После `R/accept` пункт становится COMPLETED. До принятия успешный запуск даёт AWAITING_REVIEW.

Завершение:

1. Закрыть обязательные пункты; разобрать совпадения и документы.
2. `POST V/submit-review`.
3. `POST V/complete` с `decision`, `comment`, `expectedUpdatedAt` из свежей карточки; для APPROVED_WITH_CONDITIONS обязательны `conditions`. Возможен `validUntil`.

Изменение данных после отправки возвращает проверку в IN_PROGRESS, требуется повторная отправка. Устаревший expectedUpdatedAt отклоняется. Безусловное APPROVED запрещено при незакрытых рисках и неразобранных результатах. Устранив риск, менеджер не переписывает исходный факт долга: отдельно сохраняются доказательство и решение об устранении.

## Автоматические проверки

Одиночный и пакетный запуск требуют `Idempotency-Key`. Повтор с тем же ключом возвращает тот же запуск; для новой попытки нужен новый ключ. Один пункт не запускается параллельно повторно.

Пакет возвращает `started` и `skipped` с причинами INTEGRATION_NOT_CONFIGURED / MISSING_DATA / ALREADY_RUNNING / WORKER_DISABLED. Если адаптеров нет, `started=[]`, задач и результатов не создаётся. Одиночный неподключённый источник возвращает 503.

Рабочий адаптер регистрируется в `VerificationAdaptersRegistry`, имеет checkCode/providerCode/version и `execute(inputSnapshot, AbortSignal)`. Возвращает JSON результата в том же формате, что ручной результат. Ответ проходит серверную валидацию. Тестовый адаптер существует только в тестах; в runtime не регистрируется.

Worker: QUEUED → RUNNING → SUCCEEDED/FAILED. Успешный результат ожидает принятия менеджером. Интервал опроса 2 секунды, тайм-аут источника 45 секунд, lease 90 секунд, heartbeat 10 секунд. Сетевой запрос не держит транзакцию. Потерянная lease завершает запуск FAILED с WORKER_LEASE_EXPIRED; новая попытка создаётся новым запуском. Ответ отменённой задачи не сохраняется. Персональные данные и тексты ошибок поставщика не попадают в обычные журналы.

`VERIFICATION_WORKER_ENABLED=false` отключает worker и возможность постановки новых автозадач. При отсутствии адаптеров полезных автоматических запросов нет. Фронт получает состояние повторными GET карточки/запуска; SSE и WebSocket не требуются.

## Файлы и эксплуатация

Локальное хранилище: `VERIFICATION_STORAGE_PATH`, по умолчанию `.local/verification-documents`. Docker использует `/var/lib/zaloghub/verifications` и постоянный named volume `verification_documents`; директория принадлежит пользователю node. Для нескольких API-реплик потребуется общее хранилище. Содержимое файлов нужно резервировать вместе с БД: один pg_dump содержит только метаданные и ссылки.

Скачивание — attachment, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`. Физический путь не принимается от клиента, storageKey генерируется сервером. BigInt размеров сериализуется строкой; суммы Prisma Decimal также передаются строками.

Миграция `20261113010000_verification_review_status` добавляет AWAITING_REVIEW. SQL-ограничения прежней миграции сохраняются.

## Проверки

`pnpm --dir apps/api test:borrower-verifications:backend` требует явно заданный локальный `TEST_DATABASE_URL` на `zaloghub_migration_test`. Проверяются реальная цепочка миграций, сервисы и HTTP с JWT. Собственная случайная схема и временные файлы удаляются после тестов; рабочая БД не используется.

Общий `pnpm --dir apps/api test` включает unit-тесты правил; интеграционные тесты включаются при наличии TEST_DATABASE_URL (в CI он уже установлен). Проверена также загрузка скомпилированного Nest-модуля для проверки DI.
