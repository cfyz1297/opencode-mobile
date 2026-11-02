# Архитектура

## Обязательные разделы

### 1) Архитектурный стиль

- Основной стиль: **слоистый клиент с событийным ядром**. Слои: маршруты (`app/`) → глобальные сторы (`src/stores/`) → HTTP/SSE-клиент (`src/lib/sdk.ts`) → чистый адаптер протокола (`src/lib/v2-compat.ts`) → сеть. Параллельно работает событийная ветка: SSE-поток → `V2EventAdapter` → V1-события → сторы.
- Почему такая классификация: каждое обращение к серверу идёт через единственный клиент `createClient()` (`src/lib/sdk.ts:300 (createClient)`), а все V2-пейлоады нормализуются в V1-форму в отдельном модуле без RN-импортов (`src/lib/v2-compat.ts:1-11`). Экраны и сторы написаны против V1-формы и о V2 не знают — так и задумано («additive adapter», `AGENTS.md`, комментарий `src/lib/sdk.ts:6-8`).
- Основные ограничения, формирующие дизайн:
  1. **V2 API не имеет `message.part.updated`** — стриминг приходит дельтами на уровне сессии (`session.text.delta`, `session.reasoning.delta`, `session.tool.*`), поэтому сторы работают на синтезированных V1-событиях (`src/lib/v2-compat.ts:584-624 (buildFormAnswer)`).
  2. **SSE волатилен**: при реконнекте поток продолжается «с текущего момента», пропущенные события не воспроизводятся (`src/stores/events.ts` (`resyncBusySessions`, `resyncCurrentSession`)); отсюда watchdog'и и дозагрузка переписки.
  3. **Мобильная сеть**: сокет может умереть без FIN, а сервер шлёт только heartbeat раз в ~15 с (`src/lib/stream-watchdog.ts:1-12`).
  4. **Один клиент на соединение**: клиент кэшируется по паре (база, каталог) и привязан к своему серверу, чтобы данные не «протекали» между серверами (`src/lib/directory-client.ts:3-19`, `src/stores/sessions.ts:585-595 (handleEvent)`).

### 2) Поток системы

```text
Экран (app/*) → стор (src/stores/*) → client.session.prompt() (src/lib/sdk.ts)
   → HTTP /api/* (Basic auth + x-opencode-directory) → opencode serve
   ← SSE GET /api/event → SSEParser (src/lib/sse.ts) → V2EventAdapter (src/lib/v2-compat.ts)
   → V1-события (session.status / message.updated / message.part.updated / question.asked …)
   → events.ts → sessions.ts (part-batcher → состояние) → ререндер экрана
```

Пошагово:
1. **Вход.** Пользователь открывает экран; `app/_layout.tsx` уже поднял сторы: `loadConnections()` строит клиент по активному соединению (`src/stores/connections.ts:104-153 (loadConnections)`), затем `useEvents.connect()` открывает SSE (`app/_layout.tsx:130-146 (RootLayout)`).
2. **Запрос.** Экран вызывает действие стора, например `sendMessage()`. Стор выбирает клиент по каталогу сессии (`clientFor`, `src/stores/sessions.ts:108-114 (abortedSessions)`) и вызывает `client.session.prompt()`.
3. **Транспорт.** `sdk.ts` добавляет заголовки (`Authorization: Basic …`, `x-opencode-directory` — `src/lib/headers.ts:23-43 (buildRequestHeaders)`), нормализует `baseUrl` (`src/lib/sdk.ts:313 (createClient)`), разворачивает V2-обёртки `{data}` (`src/lib/v2-compat.ts:85-92 (unwrapData)`) и клампит `limit ≤ 200` (`src/lib/v2-compat.ts:94-98 (unwrapData)`).
4. **Стриминг.** `client.global.events()` читает поток через `expo/fetch` (нужен `ReadableStream`), парсит SSE (`src/lib/sse.ts`), при необходимости дотягивает полный объект сессии по `session.created`/`session.renamed` (`src/lib/sdk.ts:402-415 (events)`) и отдаёт события через `V2EventAdapter.adapt()` (`src/lib/v2-compat.ts:617 (adapt)`).
5. **Состояние.** `src/stores/events.ts` маршрутизирует события: статусы, уведомления, permissions/questions; части сообщений попадают в стор через `createPartBatcher` (склейка ~40 мс, `src/lib/part-batch.ts:16-36 (createPartBatcher)`, `src/stores/sessions.ts:28-48 (pageSize)`).
6. **Выход.** Экран рендерит `messages`/`parts` из стора; Markdown — `react-native-marked` с кастомным рендерером (`src/components/markdown/Markdown.tsx`).

### 3) Ответственность слоёв

| Слой / модуль | Владеет | Не должен владеть | Evidence |
|---------------|---------|-------------------|----------|
| `app/**` (маршруты) | Композиция UI, локальный стейт, навигация, вызовы сторов | Сетевые вызовы напрямую, парсинг V2 | `app/session/[id].tsx`, `app/(tabs)/index.tsx` |
| `src/stores/events.ts` | SSE-соединение, реконнект с backoff, watchdog'и, статусы сессий, permissions/questions, уведомления | Хранение переписки | `src/stores/events.ts` (`connect`, `scheduleReconnect`, `stallWatchdog`) |
| `src/stores/sessions.ts` | Список сессий, текущая сессия, сообщения/части, оптимистичные сообщения, revert | SSE-подключение | `src/stores/sessions.ts` |
| `src/stores/connections.ts` | Соединения, SecureStore, активный клиент, каталог сессии, проекты | UI | `src/stores/connections.ts` |
| `src/stores/catalog.ts` | Агенты, команды, провайдеры/модели, выбор модели/варианта | Рендер пикеров | `src/stores/catalog.ts` |
| `src/stores/settings.ts`, `auth.ts`, `model-visibility.ts` | Настройки, биометрия, видимость моделей | Сеть | `src/stores/settings.ts`, `src/stores/auth.ts`, `src/stores/model-visibility.ts` |
| `src/lib/sdk.ts` | HTTP/SSE-транспорт, заголовки, таймауты, маппинг в V1-типы | UI, хранение | `src/lib/sdk.ts` |
| `src/lib/v2-compat.ts` | Чистые преобразования V2↔V1 (сессии, сообщения, формы, события, каталог) | Сеть, RN-импорты | `src/lib/v2-compat.ts` |
| `src/components/**` | Презентация и взаимодействие | Бизнес-логика, запросы | `src/components/chat/*` |
| `android/**` | Нативные инсеты IME, манифест, подпись | Логика приложения | `android/app/src/main/java/cc/agentlabs/opencode/MainActivity.kt` |

### 4) Повторяемые паттерны

| Паттерн | Где | Зачем |
|---------|-----|-------|
| Adapter (V2→V1) | `src/lib/v2-compat.ts` (`mapSession`, `mapMessages`, `mapProviders`, `V2EventAdapter`) | Сохранить сторы/экраны без переписывания при смене API |
| Singleton-сторы (zustand) | `src/stores/*.ts`, каждый модуль создаёт `useX` один раз | Глобальное состояние без DI-контейнера |
| Кэш клиентов по базе (WeakMap) | `src/lib/directory-client.ts` | Отдельный клиент на каталог, без утечки креденшелов как ключей |
| «Эпоха соединения» + seq-guard | `connectionEpoch`, `selectSeq`, `loadOlderSeq`, `refreshSeqCounter` (`src/stores/sessions.ts:98-105 (abortedSessions)`) | Поздний ответ не перезаписывает более новый выбор/другой сервер |
| Watchdog (2 уровня) | `src/lib/stream-watchdog.ts` (мёртвый сокет, 30 с), `src/lib/run-watchdog.ts` (тихий прогон, 12 с) | Локальное восстановление «Работаю…» без перезахода в сессию |
| Батчинг дельт | `src/lib/part-batch.ts`, `applyParts` в `src/stores/sessions.ts:31 (partBatcher)` | Один рендер на ~40 мс вместо одного на дельту |
| Оптимистичное сообщение + сверка | `temp-` сообщения и `reconcileTemps` (`src/lib/message-merge.ts:67 (reconcileTemps)`) | V2 не присылает событие о user-сообщении |
| Fail-closed | `src/lib/connection-health.ts:10-20 (CONNECTION_PROBE_TIMEOUT_MS)`, `src/lib/api-error.ts` | Любой сбой/не-2xx/не-JSON = «сервер недоступен», а не успех |
| Внедрение зависимостей в чистые модули | `createHistory(storage)` (`src/lib/offline-history.ts:30 (createHistory)`), `ChatwootDeps` (`src/lib/chatwoot.ts:17-21 (ChatwootDeps)`), `createTunnelConnector` (`src/lib/tunnel.ts`) | Тестируемость под `node --test` без нативных модулей |

### 5) Известные архитектурные риски

- **Адаптер — единственная точка правды о протоколе.** `v2-compat.ts` (1010 строк) руками описывает V2-пейлоады «по живому OpenAPI», без генерации (`src/lib/v2-compat.ts:24-26`); расхождение с сервером проявится как тихо пустые поля. Покрытие ветвей модуля 68 % (ниже остальных).
- **Два источника истины о «занятости»**: SSE-статус и `/api/session/active`; приоритет отдаётся active-списку (`src/stores/events.ts:206-234 (resyncBusySessions)`). На серверах старше 2.0.24 работает эвристика по хвосту переписки (`src/stores/events.ts:217 (resyncBusySessions)`) — там возможен вечный «busy» (`HANDOFF.md:69`).
- **Изоляция между серверами держится на ручных сбросах.** Эпоха соединения и очистка стора выполняются подпиской на `useConnections` (`src/stores/sessions.ts:585-595 (handleEvent)`); любой новый стор с кэшем обязан сам повторить этот паттерн.
- **Гонки «сообщение отправлено, но его ещё нет в переписке»** лечатся таймерами сверки (1.2 с и 4 с, `src/stores/sessions.ts:387-393 (sendMessage)`) — это эвристика, а не гарантия.
- **Крупные экраны-«божественные объекты»**: `app/(tabs)/index.tsx` — 1546 строк, `app/session/[id].tsx` — 1389, `app/connection/add.tsx` — 947. Логика частично вынесена в `src/lib`, но состояние и обработчики живут в экранах.
- **Нативные правки вне JS-слоя**: поведение клавиатуры зависит от `MainActivity.installImeReporter()` и обязано совпадать с `src/lib/use-keyboard-height.ts` (комментарий-контракт `MainActivity.kt:51-52`); рассинхронизация не ловится typecheck.

### 6) Evidence

- `src/lib/sdk.ts`
- `src/lib/v2-compat.ts`
- `src/lib/sse.ts`
- `src/stores/events.ts`
- `src/stores/sessions.ts`
- `src/stores/connections.ts`
- `src/stores/catalog.ts`
- `app/_layout.tsx`
- `app/session/[id].tsx`
- `src/lib/directory-client.ts`
- `src/lib/part-batch.ts`
- `src/lib/stream-watchdog.ts`
- `src/lib/run-watchdog.ts`
- `src/lib/connection-health.ts`
- `src/lib/message-merge.ts`
- `android/app/src/main/java/cc/agentlabs/opencode/MainActivity.kt`
- `src/lib/use-keyboard-height.ts`
