# Внешние интеграции

## Обязательные разделы

### 1) Реестр интеграций

| Система | Тип | Назначение | Модель аутентификации | Критичность | Evidence |
|---------|-----|-----------|------------------------|-------------|----------|
| `opencode serve` (V2 REST + SSE) | HTTP API | Вся работа с сессиями, сообщениями, моделями, файлами, формами | HTTP Basic `opencode:<пароль>` (пустой username/`Bearer` → 401) | высокая | `src/lib/sdk.ts`, `src/lib/headers.ts:38-41 (buildRequestHeaders)`, `README.md:43` |
| GitHub Releases API | HTTP API | Проверка обновлений: `GET releases/latest`, не чаще 1 раза в 24 ч | без авторизации (публичный endpoint) | средняя | `src/lib/update-check.ts:47-48 (RELEASES_API)`, `src/lib/update-check-policy.ts:39 (CHECK_INTERVAL_MS)` |
| `opencode.agentlabs.cc/api/beta-signup` | HTTP API | Запись в waitlist OpenCode Connect (Brevo-список) | без авторизации; e-mail + `source` | низкая | `src/lib/waitlist.ts:14-16 (WAITLIST_ENDPOINT)` |
| Chatwoot (public inbox API) | HTTP API | Отправка обезличенного отчёта диагностики в поддержку | inbox identifier в APK; контакты анонимные | низкая (по факту выключена) | `src/lib/chatwoot.ts:1-33`, `src/lib/diagnostics.ts:198-203 (CHATWOOT_SOURCE_KEY)` |
| `https://www.gstatic.com/generate_204` | HTTP API | Проверка «есть ли вообще интернет» в диагностике | нет | низкая | `src/lib/diagnostics.ts:18 (INTERNET_CHECK_URL)` |
| SecureStore (Android Keystore / iOS Keychain) | Устройство-хранилище | Пароли серверов, настройки, офлайн-история | политика `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | высокая | `src/stores/connections.ts:19 (SECURE_OPTIONS)`, `src/lib/history-storage.ts:4-6 (offlineHistory)` |
| AsyncStorage | Устройство-хранилище | Видимость моделей, состояние проверки обновлений, очередь waitlist | нет (не секреты) | низкая | `src/stores/model-visibility.ts:3`, `src/lib/update-check.ts:52-53 (getItem)`, `src/lib/waitlist-queue-storage.ts:11-18` |
| `expo-notifications` | Локальные уведомления | «Задача завершена», «Нужно подтверждение», вопросы, ошибки, обрыв связи | разрешение ОС | средняя | `src/lib/notifications.ts:89,108,153` |
| Подпись APK (Gradle + GitHub secrets) | CI-интеграция | Постоянный keystore, чтобы обновления ставились поверх | `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | высокая | `.github/workflows/build.yml:84-103`, `android/app/build.gradle` |

Явно отсутствуют: Sentry/PostHog (удалены, `README.md:55,74`), БД, очереди, push-сервер, WebSocket (клиент использует только SSE — `tests/fixtures/mock-opencode-server.ts:10-14`).

Прокси/туннели: приложение не проксирует трафик, но поддерживает подключение через Cloudflare named tunnel или ngrok — адрес вводится в мастер (`app/connection/tunnel.tsx`, `src/lib/tunnel.ts`), причём `trycloudflare.com` отвергается, т.к. quick tunnel не держит SSE (`README.md:92`, `src/lib/tunnel.ts`).

### 2) Каталог endpoint'ов OpenCode (по `src/lib/sdk.ts`)

| Метод и путь | Назначение | Evidence |
|--------------|-----------|----------|
| `GET /api/info` | health/version (`healthy ?? true`) | `src/lib/sdk.ts:348-351 (health)` |
| `GET /api/event` | SSE-поток событий (`Accept-Encoding: identity`) | `src/lib/sdk.ts:356-368 (events)` |
| `GET /api/project`, `GET /api/location` | Проекты и текущая локация | `src/lib/sdk.ts:436-442,479-498` |
| `GET /api/fs/list?path=` | Листинг файлов/папок сервера (`{location, data}`) | `src/lib/sdk.ts:450-462 (list)` |
| `GET /file/roots` | Корни ФС; на 404 → `null` (все V2-серверы) | `src/lib/sdk.ts:469-476 (roots)` |
| `GET /api/session`, `POST /api/session` | Список (без каталога — все проекты) и создание (`location.directory` в теле) | `src/lib/sdk.ts:322-333,506-520` |
| `GET/PATCH/DELETE /api/session/{id}` | Чтение, переименование, удаление | `src/lib/sdk.ts:317-320,522-534` |
| `GET /api/session/{id}/message?limit=` | Переписка (`limit ≤ 200`, приходит newest-first) | `src/lib/sdk.ts:536-545 (messages)`, `src/lib/v2-compat.ts:94-98,127-139` |
| `GET /api/session/active` | Список реально выполняющихся сессий | `src/lib/sdk.ts:551-554 (active)` |
| `POST /api/session/{id}/model`, `…/agent` | Переключение модели/агента перед промптом | `src/lib/sdk.ts:576-601 (prompt)` |
| `POST /api/session/{id}/prompt` | Отправка сообщения (без клиентского таймаута) | `src/lib/sdk.ts:614-634 (prompt)` |
| `POST /api/session/{id}/command` | Слэш-команда (без таймаута) | `src/lib/sdk.ts:650-664 (command)` |
| `POST /api/session/{id}/interrupt` | Прерывание прогона | `src/lib/sdk.ts:666-671 (abort)` |
| `POST /api/session/{id}/compact` | Компакция | `src/lib/sdk.ts:677-683 (compact)` |
| `GET /api/session/{id}/diff` | Diff сессии | `src/lib/sdk.ts:685-692 (diff)` |
| `POST /api/session/{id}/revert/stage`, `DELETE …/revert` | Реверт/отмена реверта | `src/lib/sdk.ts:699-713 (revert)` |
| `GET /api/permission/request`, `POST /api/session/{id}/permission/{requestID}/reply` | Запросы разрешений | `src/lib/sdk.ts:716-724 (unrevert)` |
| `GET /api/session/{id}/form`, `GET …/form/{id}`, `POST …/form/{id}/reply`, `DELETE …/form/{id}` | Вопросы модели (V2 Form service) | `src/lib/sdk.ts:726-753 (reply)`, `src/lib/v2-compat.ts:476-547 (joinPath)` |
| `GET /api/agent`, `GET /api/command`, `GET /api/model`, `GET /api/model/default`, `GET /api/config` | Каталоги и конфиг | `src/lib/sdk.ts:755-804 (reject)` |
| `POST /api/integration/{id}/connect/key` → `PUT /auth/{id}` → `PUT /api/auth/{id}` | Подключение провайдера по API-ключу (по очереди при 404/405/501) | `src/lib/provider-auth.ts:16-37,84-86` |

### 3) Хранилища данных

| Хранилище | Роль | Слой доступа | Ключевой риск | Evidence |
|-----------|------|--------------|---------------|----------|
| SecureStore: `opencode_connections` | JSON-список соединений (без паролей) | `src/stores/connections.ts` | Раздувание/повреждение JSON — есть терпимый парсер (`parseStoredJSON`) | `src/stores/connections.ts:15,73-81` |
| SecureStore: `opencode_password_<id>` | Пароль сервера | `src/stores/connections.ts` | Утечка при политике по умолчанию — закрыто `SECURE_OPTIONS` | `src/stores/connections.ts:16,19,167` |
| SecureStore: `opencode_settings`, `opencode_auth_settings` | Настройки UI и биометрии | `src/stores/settings.ts`, `src/stores/auth.ts` | Повреждённый JSON → дефолты | `src/stores/settings.ts:8,52-62`, `src/stores/auth.ts:5,67-68` |
| SecureStore: `opencode_history_<connectionId>` (+ чанки) | Офлайн-история, только текст, read-only | `src/lib/offline-history.ts` через `src/lib/history-storage.ts` | Объём (лимиты 120k символов, 320 чанков, 40 сообщений) | `src/lib/offline-history.ts:9-13,19-28` |
| SecureStore: `opencode_chatwoot_source_id` | Идентификатор контакта поддержки | `src/lib/diagnostics.ts` | Пишется только при включённой доставке (сейчас выключена) | `src/lib/diagnostics.ts:193-206 (CHATWOOT_SOURCE_KEY)` |
| AsyncStorage: `opencode_model_visibility_v1` | Скрытые модели по соединению | `src/stores/model-visibility.ts` | Настройка локальна для устройства | `src/lib/model-visibility.ts:3 (STORAGE_KEY)` |
| AsyncStorage: ключи проверки обновлений | Отметка о последней проверке/скрытой версии | `src/lib/update-check.ts` | — | `src/lib/update-check.ts:52-53,99`, `src/lib/update-check-policy.ts:99 (DISMISSED_KEY)` |
| AsyncStorage: очередь waitlist | Отложенные e-mail для повторной отправки | `src/lib/waitlist-queue-storage.ts` | Не секрет, поэтому не SecureStore | `src/lib/waitlist-queue-storage.ts:1-18` |

### 4) Секреты и учётные данные

- Источники: пользовательский ввод (пароль сервера, API-ключ провайдера), GitHub Actions secrets (`EXPO_PUBLIC_CHATWOOT_INBOX_IDENTIFIER`, `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`), локальный `android/app/release.keystore` (не в Git: `*.keystore` в `.gitignore`).
- Хардкод-проверка: в коде нет паролей/токенов; единственные «вшитые» значения — inbox identifier Chatwoot (приходит из env) и публичные URL (`src/lib/links.ts`, `src/lib/update-check.ts:47-48 (RELEASES_API)`, `src/lib/waitlist.ts:14 (WAITLIST_ENDPOINT)`). `android/sentry.properties` содержит org/project Sentry (`vibetechnologies/opencode-mobile`), но не токен — файл остался от upstream.
- API-ключи провайдеров клиент не сохраняет: отправляются на сервер и забываются (`src/lib/provider-auth.ts:1-4`, `src/lib/sdk.ts:773-799 (list)`).
- Жизненный цикл: пароли пишутся только при вводе (пустое поле = «оставить прежний»), удаляются вместе с соединением (`src/stores/connections.ts:205-237,302-313`); ротация пароля сервера — вручную через экран редактирования.
- Транспорт: `usesCleartextTraffic=true` (`app.json:39`) и `NSAllowsArbitraryLoads` (`app.json:29-32`) — осознанно для LAN/Termux; предупреждение о пароле по `http://` показывается, но не блокирует (`src/lib/connection-security.ts:10-27 (sendsPasswordInClearText)`).

### 5) Надёжность и поведение при сбоях

- Таймауты: общий запрос 30 с (`src/lib/sdk.ts:207 (REQUEST_TIMEOUT_MS)`); тест соединения 12 с (`src/stores/connections.ts:27 (CONNECTION_TEST_TIMEOUT_MS)`); health-probe 5 с (`src/lib/connection-health.ts:8 (CONNECTION_PROBE_TIMEOUT_MS)`); диагностические пробы 8 с (`src/lib/diagnostics.ts:16 (PROBE_TIMEOUT_MS)`); проверка обновлений и waitlist 8 с (`src/lib/update-check.ts:49 (TIMEOUT_MS)`, `src/lib/waitlist.ts:17 (WAITLIST_FALLBACK_EMAIL)`); `POST /prompt` и `/command` — **без клиентского таймаута** (`timeoutMs = 0`), иначе обрыв соединения отменял прогон на сервере (`src/lib/sdk.ts:614-626,650-658`).
- Повторы: SSE-реконнект с backoff `[1,2,4,8,15]` с ±25 % джиттера и стабилизацией 10 с (`src/stores/events.ts:77-79,318-345`); при 401/403 цикл останавливается и выставляется `authError` (`src/stores/events.ts:619-629 (useEvents)`). Повторов HTTP-запросов (кроме цепочки provider connect) нет.
- Восстановление: watchdog сокета 30 с (`src/lib/stream-watchdog.ts:12 (STREAM_STALL_MS)`), watchdog прогона 12 с с одной дозагрузкой переписки на «тихое окно» (`src/lib/run-watchdog.ts:18,31-40`), сверка с `/api/session/active` после реконнекта (`src/stores/events.ts:177-253 (activeSessionIDs)`).
- Fallback'и: `/file/roots` → 404 → `null` (`src/lib/sdk.ts:469-476 (roots)`); `GET /api/model/default` → ошибка → `null` (`src/lib/sdk.ts:767-769 (list)`); ответы без `healthy` трактуются как `true` на уровне SDK (`src/lib/sdk.ts:350 (health)`), но `probeConnection` требует строго `true` (`src/lib/connection-health.ts:17 (probeConnection)`).
- Circuit-breaker: нет; роль ограничителя играют watchdog'и, backoff и «одна дозагрузка на тихое окно».

### 6) Наблюдаемость интеграций

- Логирование внешних вызовов: только ошибки/переходы состояний — `console.warn("[SSE] …")`, `console.warn("[Events] Failed to resync …")`, `console.warn("[SSE] Failed to refetch session …")` (`src/lib/sdk.ts:395-412 (events)`, `src/stores/events.ts:160,239,339`). Успешные HTTP-вызовы не логируются.
- Встроенная диагностика: при неудачном подключении выполняются параллельные пробы и классификация (`src/lib/diagnostics.ts`, `src/lib/diagnostics-classify.ts`), отчёт можно скопировать/поделиться (`shareReport`), хост и URL редактируются (`src/lib/scrub.ts`).
- Метрики/трейсинг: отсутствуют; телеметрия удалена (`README.md:55`).
- Пробелы видимости: нет счётчиков реконнектов/латентности, нет отправки крашей (Sentry удалён), доставка отчёта в Chatwoot выключена жёстким флагом `DIAGNOSTICS_SUPPORT_DELIVERY = false` (`src/lib/diagnostics.ts:198-203 (CHATWOOT_SOURCE_KEY)`) — то есть отчёт уходит только вручную, через буфер обмена/шаринг.

### 7) Evidence

- `src/lib/sdk.ts`
- `src/lib/v2-compat.ts`
- `src/lib/headers.ts`
- `src/lib/auth.ts`
- `src/lib/provider-auth.ts`
- `src/lib/connection-health.ts`
- `src/lib/connection-security.ts`
- `src/lib/update-check.ts`, `src/lib/update-check-policy.ts`
- `src/lib/waitlist.ts`, `src/lib/waitlist-queue-storage.ts`
- `src/lib/chatwoot.ts`, `src/lib/diagnostics.ts`, `src/lib/scrub.ts`
- `src/stores/connections.ts`, `src/stores/events.ts`, `src/stores/model-visibility.ts`
- `src/lib/offline-history.ts`, `src/lib/history-storage.ts`
- `.github/workflows/build.yml`
- `app.json`, `android/app/src/main/AndroidManifest.xml`, `android/sentry.properties`
- `README.md`
