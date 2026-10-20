# Реестр багов opencode-mobile

Дата аудита: 2026-10-20 · ревизия: `f29a97d` (v0.2.9, package.json/app.json/gradle парны) · полное чтение всех экранов, stores и lib-модулей + 5 параллельных автономных аудитов с последующей ручной верификацией каждого кандидата.

Правила чтения реестра:

- Каждый пункт подтверждён чтением кода (цитаты приведены). Тестовые пиннинги: `test(..., { skip: "BUG-NNN" })` — при фиксе снимвать `skip`, тест должен позеленеть. Пины на месте: BUG-003 (`src/lib/v2-compat.test.ts`), BUG-006 (`src/lib/quick-connect-url.test.ts`).
- `sdk.ts` не импортируется из node-тестов (содержит `import … from "expo/fetch"`, который не резолвится вне RN runtime) — пины sdk-багов (BUG-001, BUG-002, BUG-016-sdk) отложены до фикса.
- SUSPECT — вероятно баг, но требует проверки на устройстве или по контракту сервера; точные шаги проверки указаны.
- Фиксы в этой ревизии НЕ применялись (кроме двух чистых экстракций в `src/lib` с сохранением поведения: `revert-filter.ts`, `quick-connect-url.ts`).

Сводная таблица:

| # | Severity | Коротко | Файл |
|---|----------|---------|------|
| 001 | HIGH | file.list двойной unwrap — браузер папок всегда пуст | src/lib/sdk.ts |
| 002 | HIGH | /command гибнет по 30с таймауту | src/lib/sdk.ts |
| 003 | HIGH | failed-ран показывается как успешный «Task completed» | src/lib/v2-compat.ts |
| 004 | HIGH | Question-flow мёртв под V2 ( вопросы не видны/не отвечаются ) | src/lib/sdk.ts + events.rs + v2-compat.ts |
| 005 | HIGH | tap по push при холодном старте потерян | src/lib/notifications.ts |
| 006 | HIGH | Quick Connect: https-URL получает :4096 | app/connection/add.tsx |
| 007 | MED | Test на экране правки даёт ложный 401 | app/connection/[id].tsx |
| 008 | MED | refreshMessages/loadOlderMessages без seq-guard | src/stores/sessions.ts |
| 009 | MED | «призрачное» сообщение после неудачной отправки | src/stores/sessions.ts |
| 010 | MED | loadSessions затирает SSE-добавленные сессии | src/stores/sessions.ts |
| 011 | MED | refreshPending заменяет pending целиком | src/stores/events.ts |
| 012 | MED | /undo игнорирует активную точку revert | app/session/[id].tsx |
| 013 | MED | «Connected»-баннер мигает при disconnect | app/session/[id].tsx |
| 014 | MED | Модалки New Session/Rename не закрываются Back на Android | app/(tabs)/index.tsx |
| 015 | MED | провал каталога молча сбрасывает выбор модели | src/stores/catalog.ts |
| 016 | MED | JSON.parse без try ×4 (auth/settings/connections/sdk) | см. пункт |
| 017 | MED | waitlist: двойной flush и потеря свежего enqueue | src/lib/waitlist.ts |
| 018 | MED | нет in-flight guard на отправке (двойная отправка) | app/session/[id].tsx |
| 019 | MED | QuestionPrompt после ошибки блокирует повторный ответ навсегда | src/components/chat/QuestionPrompt.tsx |
| 020 | MED | после re-lock биометрия не предлагается автоматически | src/components/AuthGate.tsx |
| 021 | MED | провалившийся switch model/agent запоминается как успешный | src/lib/sdk.ts |
| 022 | LOW | Stop недоступен, если набран текст | app/session/[id].tsx |
| 023 | LOW | PermissionPrompt:dopпустим double-tap | src/components/chat/PermissionPrompt.tsx |
| 024 | LOW | Речь: язык жёстко en-US; start() не await | src/lib/speech.ts |
| 025 | LOW | Захардкоженные EN-строки (You/Assistant/tokens/Copy/…) | MessageBubble, CodeBlock, auth |
| 026 | LOW | UpdateBanner: dismiss до успешного openURL | src/components/UpdateBanner.tsx |
| 027 | LOW | SlashPopover: дубли trigger, конфликтные keys | [id].tsx + SlashPopover.tsx |
| 028 | LOW | Преждевременный обрыв prune оставляет утечкиfonts | src/lib/v2-compat.ts |
| 029 | LOW | notifications dedupe-карта растёт без обрезки | src/lib/notifications.ts |
| 030 | LOW | store-review: NaN при повреждённом счётчике | src/lib/store-review.ts |
| 031 | LOW | SessionInfo: строки могут вытесняться (flexShrink) | src/components/chat/SessionInfo.tsx |
| 032 | LOW | messageData пересобирается на каждый токен (плавность) | app/session/[id].tsx |
| 033 | LOW | textAccum не очищается при повторном started | src/lib/v2-compat.ts |

SUSPECT: S-1 jump-to-top на inverted (Android), S-2 shape файлов в prompt-запросе, S-3 форма `session.sync/build` для V2 домена вопросов, S-4 «синхронизация чипа модели» переписывает вручную выбранный вариант.

---

## HIGH

### BUG-001 — file.list применяет unwrapData дважды: DirectoryBrowserSheet всегда показывает «нет подпапок»
- **Где:** `src/lib/sdk.ts:425-433` (+ контракт `unwrapData` в `src/lib/v2-compat.ts:78-87`, ожидаемая форма ответа — `:398-415`).
- **Симптом:** браузер директорий (выбор папки проекта при добавлении подключения) всегда пуст, для любого сервера и папки.
- **Доказательство:** sdk.file.list делает:
  ```ts
  const body = unwrapData<{ location?: { directory?: string }; data?: unknown[] }>(await request(config, `/api/fs/list?...`))
  const cwd = body?.location?.directory ?? config.directory ?? ""
  return mapFileEntries(body?.data, cwd)
  ```
  а `unwrapData` возвращает `record.data` при наличии ключа — значит на форме `{location, data: Entry[]}` в `body` уже лежит сам МАССИВ записей; `body?.location` и `body?.data` после этого — `undefined`, и `mapFileEntries(undefined)` возвращает `[]`.
- **Ожидание:** список каталогов/файлов сервера; **Факт:** всегда `[]`.
- **Сценарий:** подключение → «Выбрать папку…» → любой сервер с непустым каталогом.
- **Фикс:** не применять unwrapData к fs-эндпойнтам (либо проверять `Array.isArray(body)`/оставлять `{location,data}`). Пиннинг: добавить skipped-тест на `client.file.list` после того, как sdk.ts станет импортируемым в node (см. примечание о `expo/fetch`), или вынести сборку fs-ответа в чистую функцию v2-compat.
- **Тест-пиннинг:** отсутствует (см. выше).

### BUG-002 — session.command не передаёт timeoutMs: длинные серверные команды убиваются на 30-й секунде
- **Где:** `src/lib/sdk.ts:590-606` (вызов `fetchWithTimeout(url, {…})` без третьего аргумента) + `REQUEST_TIMEOUT_MS = 30_000` (`:204`, обработка в `:270-287`).
- **Симптом:** серверная команда (`/compact`, кастомные / команды, работающие >30с — например, медленный LLM-этап) рвётся: «Request timed out after 30000ms».
- **Доказательство:** `health()` и `prompt()` выставляют `timeoutMs` явно (`:337` — для health; `:578-582` — `0` для prompt: «No client-side timer… a client-side timer aborting that connection cancels the run server-side»), а `command` — нет.
- **Ожидание:** командам — длинный/нулевый таймаут, как у prompt; **Факт:** 30с.
- **Сценарий:** `/compact` на большой сессии; серверные команды с туловом, работающим >30с.
- **Фикс:** `fetchWithTimeout(url, {…}, 0)` в `command()` (семантика — как в prompt: без клиентского таймера).

### BUG-003 — session.execution.failed неотличим от succeeded: «Task completed» на провале, без ошибки, в плюс к store-review
- **Где:** `src/lib/v2-compat.ts:463-469` (маппинг), потребитель `src/stores/events.ts:266-291`.
- **Доказательство:**
  ```ts
  case "session.execution.succeeded":
  case "session.execution.failed":
  case "session.execution.interrupted": {
    return [{ type: "session.status", properties: { sessionID: data.sessionID, status: { type: "idle" } } }]
  }
  ```
  На busy→idle events.ts:280-288 шлёт push «Task completed» и (кроме abort/errored) `recordSuccessfulSession()`.
- **Ожидание:** упавший рантайм информирует пользователя (банер/пуш «Ошибка задачи»); **Факт:** любой провал выглядит как успешное завершение; store-review засчитывает провал.
- **Сценарий:** отключённый/неоплаченный провайдер, 4xx-ошибка модели — рантайм падает, юзер видит «готово» и пустой ответ.
- **Фикс:** в адаптере failed → генерировать дополнительно ошибку В1 (`session.error` со сводкой `data.error.message`), а interrupted — отличимый статус; events.ts тогда разметит `erroredSessions` и не позовёт review. Пиннинг есть: `src/lib/v2-compat.test.ts`, `it.skip("BUG-003…")`.

### BUG-004 — Question-flow мёртв под V2: промпт вопросов не показывается и ответ не доходит
- **Где:** `src/lib/sdk.ts:674-683` (заглушки), `src/lib/v2-compat.ts` (в адаптере нет маппинга `question.*` — grep пуст), `src/stores/events.ts:76-88, 405-439`, `src/components/chat/QuestionPrompt.tsx`.
- **Симптом:** если V2-сервер запрашивает у юзера вопрос (формы/вопросы), приложение НЕ показывает QuestionPrompt (адаптер не транслирует question-события, `client.question.list()` всегда `[]`), а при ручном появлении (например, через session created-события) ответ НЕ отправляется:
  ```ts
  // V2 has no question flow; V2's forms are an incompatible replacement
  list: () => Promise.resolve([] as ...),
  reply: (requestID, answers) => Promise.resolve(false),
  reject: (requestID) => Promise.resolve(false),
  ```
- **Ожидание:** вопросы поверх модели доходят и отвечаются; **Факт:** UI есть, путь квён-ентом мёртв.
- **Сценарий:** модель вызывает AskUserQuestion/форму (нужна проверка S-3 какое событие V2 реально шлёт) → приложение молчит → ран зависает в ожидании ответа, юзер не видит вопроса.
- **Фикс (2 варианта):** либо реализовать трансляцию question.* в V2EventAdapter + реальный POST reply/reject по контракту V2-API (нужно сверить с /openapi.json), либо честно скрыть QuestionPrompt UI под V2, чтобы не вводить в заблуждение.
- **SUSPECT часть (S-3):** точное имя V2-события/фронтенд-эндпойнта — сверить `GET /openapi.json` живого сервера.

### BUG-005 — tap по push-уведомлению при холодном старте теряется
- **Где:** `src/lib/notifications.ts:167-177` и `app/_layout.tsx:43-46`.
- **Доказательство:** используется только `Notifications.addNotificationResponseReceivedListener`; `getLastNotificationResponseAsync()` не вызывается нигде (grep). На Android/перезапущенном процессе JS поднимается ПОСЛЕ tap — listener срабатывает до того, как роутер mount’нут (`_layout.tsx:43` подписка происходит в первом эффекте), и expo рекомендует именно `getLastNotificationResponseAsync` для cold-start.
- **Ожидание:** tap по push открывает нужную сессию даже после смерти процесса; **Факт:** после холодного старта tap игнорируется.
- **Сценарий:** процесс убит; юзер тапает «Permission needed» → открывается приложение без перехода в чат.
- **Фикс:** в `_layout.tsx` до подписки: `const initial = await Notifications.getLastNotificationResponseAsync()` → тот же роутинг; дедупликация с listener по `notification.request.identifier` (иначе двойной переход).
- **Проверка:** на Android: process kill → tap → маршрут.

## MED

### BUG-007 — «Test» на экране правки даёт ложный 401: сохранённый пароль не читается
- **Где:** `app/connection/[id].tsx:88-98` + `src/stores/connections.ts:257-271` + `buildAuth` (`src/lib/auth.ts`).
- **Доказательство:** `testConnection({…}, "edit_test", password || undefined)` — password из state (пустой: «Empty = keep existing password»); store берёт `buildAuth(connection.username, password)` — аргумент, а не SecureStore. `buildAuth` без пароля даёт undefined → запрос без Authorization → 401 на сервере с `OPENCODE_SERVER_PASSWORD`.
- **Ожидание:** Test проверяет живое подключение с сохранёнными кредами; **Факт:** предупреждение «check the password» для рабочей пары.
- **Фикс:** в `testConnection` при `source === "edit_test" && !password` и наличии сохранённого пароля (нужен отдельный вызов SecureStore в store) — использовать сохранённый.

### BUG-008 — refreshMessages/loadOlderMessages без seq-guard: устаревший fetch затирает свежие события
- **Где:** `src/stores/sessions.ts:368-388` (snapshot до awaits, запись после), `:182-210` (loadOlderMessages аналогично).
- **Доказательство:** снапшоты `currentSession`/`messages` берутся синхронно, затем `await client.session.messages(...)` (~секунды), затем `set({messages: …})` — вкладка могла смениться, могли прийти новые SSE-сообщения. В отличие от `selectSession`, где такой guard есть (`:128` `const seq = ++selectSeq`).
- **Ожидание:** результат устаревшего запроса отбрасывается (как в selectSession); **Факт:** «дёргание/откат» ленты: свежие стрим-сообщения исчезают, потом появляются.
- **Сценарий:** чат стримит ответ → pull-refresh / onLoadAll → fetch вернулся после нескольких delta → set затирает свежие parts.
- **Фикс:** копия seq-паттерна selectSession: инкремент seq до await, после — сверка `currentSession.id` (+ для loadOlder — доп. сверка количества сообщений).

### BUG-009 — «Призрачное» сообщение после неудачной отправки: два пузыря с одним текстом
- **Где:** `src/stores/sessions.ts:303-306` (добавление temp), `:340-348` (catch → refreshMessages), `src/lib/message-merge.ts:67-99` (reconcileTemps — unmatched temps остаются).
- **Доказательство:** при провале `sendMessage` ловит ошибку → `refreshMessages()`; сервер не вернул сообщение (не дошло), поэтому reconcileTemps считает temp «в полёте» и оставляет; при этом текст возвращён в композер. В чате — temp-пузырь без статуса ошибки; повторная отправка создаёт ДУБЛЬ внизу.
- **Ожидание:** при провале отправки temp удаляется (или получает статус failed); **Факт:** висит навсегда до перезагрузки.
- **Фикс:** в catch sendMessage — удалить temp данного send (id известен перед fetch) или пометить его `error` и отчистить при следующем успешном reconcile.

### BUG-010 — loadSessions пишёт список целиком: теряет сессии, добавленные SSE во время fetch
- **Где:** `src/stores/sessions.ts:108-117` (set после await), события `session.created` — `sessions.ts` handleEvent / events.ts.
- **Доказательство:** `const sessions = await client.session.list(…); set({sessions})` — wholesale. `session.created` во время in-flight list → попадает в state → перезаписывается списком с сервера, у которого новой сессии ещё нет (гонка репликации).
- **Ожидание:** merge по id (existing приоритет для свежих) / или refetch после; **Факт:** исчезнувшая сессия до следующей сверке.
- **Фикс:** `set((state) => ({sessions: mergeSessionList(state.sessions, fetched)}))` на базе session-list.ts.

### BUG-011 — refreshPending заменяет pending-списки целиком: восстанавливает уже отвеченное
- **Где:** `src/stores/events.ts:76-88` (`permissions: {…,[sessionID]: sessionPerms}`, `questions: …`), вызывается при refocus (`app/session/[id].tsx:319-330`) и из reconnect-пути.
- **Доказательство:** на экране permissions/questions удаляются оптимистично (`handlePermissionReply`), серверный список может ещё содержать заявку (гонка репликации); refreshPending возвращает её ЗАНОВО — юзер отвечает повторно, сервер может ответить ошибкой «already replied».
- **Ожидание:** merge: существующие локальные записи (id) не должны воскрешаться, если локально уже отвечены/отклонены; **Факт:** wholesale replace.
- **Фикс:** merge по id с учётом локально-в-процессе отвеченных (track pendingReplies), либо не заменять записи, чей id был отвечен последние N секунд.

### BUG-012 — /undo не учитывает активную точку revert: редактирует скрытое сообщение
- **Где:** `app/session/[id].tsx:372-393`.
- **Доказательство:**
  ```ts
  case "undo":
    const lastUser = (messages || [])
      .filter((m) => m.role === "user" && !m.id.startsWith("temp-"))
      .pop()
  ```
  `messages` — ПОЛНЫЙ массив (скрытые реверт-сообщения остаются в сторах — фильтрует только messageData). Скрип: revertMessageID активен на msg_x; последний user в полном массиве — НОВЕЕ точки revert (скрытый); /undo вызовет revertToMessage(нового) → сервер сдвинет точку revert ВПЕРЁД (в сторону настоящей истории) и баннер revert остаётся/призрак; юзер ожидал вернуть точку НАЗАД (к последнему ВИДИМОМУ user-сообщению, id < revertMessageID).
- **Фикс:** фильтр должен учитывать revert-точку: `(!revertMessageID || m.id < revertMessageID)`; при активном revertпредложать вместо этого unrevert (или открыть confirm).

### BUG-013 — «Connected»-баннер мигает при потере связи
- **Где:** `app/session/[id].tsx:578-586` (effect), `:730-733` (баннер), источник `events.ts:465-485` (`disconnect` сбрасывает `reconnectAttempts: 0`).
- **Доказательство:** `disconnect()` выставляет `reconnectAttempts: 0`; на экране:
  ```ts
  useEffect(() => { if (prevReconnecting.current && !isReconnecting) { setShowConnectedFlash(true); … } }, [reconnectAttempts])
  ```
  и рендер `showConnectedFlash && reconnectAttempts === 0` — во время disconnect-а (attempts упали с >0 до 0) баннер просто покажет «Connected» на 2 секунды при ОТКЛЮЧЁННОМ соединении.
- **Ожидание:** «Connected» показывать только при реально живом соединении; **Факт:** ложный сигнал при потере связи.
- **Фикс:** добавить в условие `&& s.connected` (useEvents connected), и гейт flash-эффекта тем же флагом.

### BUG-014 — Модалки New Session и Rename не закрываются кнопкой Back на Android
- **Где:** `app/(tabs)/index.tsx:610` (`<Modal visible={showNewSession} …>`) и `:865` (`<Modal visible={!!renaming} …>`).
- **Доказательство:** у обеих модалок нет `onRequestClose`; ModelPickerModal внутри (`:847-861`) его имеет (`ModelPickerModal.tsx:57`). RN Modal на Android без `onRequestClose` не реагирует на системный Back (dev-варнинг).
- **Ожидание:** Back закрывает модалку; **Факт:** нет реакции.
- **Фикс:** добавить `onRequestClose={() => setShowNewSession(false)}` / ` setRenaming(null)`.

### BUG-015 — провал каталога молча «стирает» выбор модели и агентов
- **Где:** `src/stores/catalog.ts:60-131`.
- **Доказательство:** `load()` НЕ имеет try/catch вокруг set; под-запросы гасятся: `agent.list().catch(() => [])`, `provider.list().catch(() => null)` → при сетевом сбое providers=[] → `chooseModelSelection({providers: [], existing})` (`src/lib/model-selection.ts:46-51`) вернёт `null` (existing невалиден на пустом списке) → `set({agents: [], commands: [], providers: [], model: null, agent: "build", loaded: true})`.
- **Ожидание:** при transient-провале не трогать уже загруженный каталог (или пометить «stale»); **Факт:** чипы модели/агента слетают на «Server default», пикер пустой; commands исчезают из SlashPopover.
- **Сценарий:** вкладка New Session → сеть отвалилась на list → выбор юзера сброшен.
- **Фикс:** в load() — если все три fetch провалились: НЕ set (или set `{providers: state.providers, stale: true}`); если provider не null (но пусто) — не трогать model, если existing был.

### BUG-016 — JSON.parse без try в 4 местах: битые storage данные бьют приложение заметной деградацией
- **Где:**
  1. `src/stores/auth.ts:58` — `JSON.parse(stored)`: catch выше общего (`:70-76`) выставляет `isAuthenticated: false` навсегда → с включенной «биометрия на сообщение» отправка блокировалась навсегда (authenticateForMessage `:110`).
  2. `src/stores/settings.ts:45` — `JSON.parse(raw)` — на битых данных весь settings load улетает в catch → настройки забываются (см. сами файлы).
  3. `src/stores/connections.ts:96-97` — `JSON.parse(stored)`/`JSON.parse(recentRaw)` → catch → список подключений пуст; пользователь может не понять, что данные в SecureStore есть, но не читаются.
  4. `src/lib/sdk.ts:252` — `JSON.parse(text)` у request(): сервер/корпоративный прокси, вернувший HTML (402 quota page, каптиву) → SyntaxError вместо ApiError → в верхнем UI появляется мусор `Unexpected token <`.
- **Ожидание:** каждый parse защищён, битое значение — fallback default + (лучше) лог/repair; **Факт:** исключения.
- **Фикс:** обернуть каждый parse; для sdk.request — конвертировать в `ApiError(0, "Non-JSON response")`. (Пиннинг sdk-ветки — см. примечание о `expo/fetch`.)

### BUG-017 — waitlist: двойной flush и потеря только что добавленного
- **Где:** `src/lib/waitlist.ts:306-341` (flushQueue: `loadQueue` → submit-цикл → `saveQueue(pending)`), `app/_layout.tsx:74-86` (flush на старте + на каждом `AppState "active"` — при запуске срабатывают ОБА), `src/lib/waitlist-queue-storage.ts:32-35`.
- **Доказательство:** flushQueue — классический read-modify-write на общем ключе без сериализации: (а) два параллельных flush оба читают очередь → двойные POST (Brevo дубль); (б) flush A идёт (>8с), юзер в это время Join → enqueueSignup пишет → flush A завершается → `saveQueue(pending)` ПЕРЕЗАПИСЫВАЕТ очередь, новых записей в pending нет → свежий signup потерян (причина, по которой AGE-87 делал очередь, нарушена).
- **Фикс:** module-level `let flushInFlight: Promise|null` (повторный вызов ждёт/ворачивается) + после submit делать merge с актуальным содержимым (`loadQueue` перед save, слить по email, не затирать новые записи) — плюс «хранить synced-и-drop» — в одну атомарную операцию на ключе.

### BUG-018 — отправка без in-flight guard: двойной tap = двойное сообщение (+ temp-id коллизия)
- **Где:** `app/session/[id].tsx:506-553` (handleSend), `src/stores/sessions.ts` (sendMessage создаёт `temp-${Date.now()}`).
- **Доказательство:** handleSend не проверяет sending-флаг; два быстрых тапа (или тап + biometric retry) → дважды вызывают sendMessage с тем же текстом → два сообщения. Дополнительно: temp-ids в одну миллисекунду collision → FlatList `key={message.id}` дубли → RN warning и вероятная путаница в списках.
- **Ожидание:** повторный тап игнорируется, пока предыдущая отправка в процессе (или более умная дедупликация); **Факт:** дубли.
- **Фикс:** в handleSend ранний return если `sending[sessionID]`; temp-id = `${Date.now()}-${counter++}` уникальный.
- **Тест-пиннинг:** на tempid — сам чистый, добавить в `message-merge.test.ts` после фикса.

### BUG-019 — QuestionPrompt после неудачного reply навсегда блокирует повторный ответ
- **Где:** `src/components/chat/QuestionPrompt.tsx:40-50` (replied ref), `app/session/[id].tsx:601-629` (catch восстанавливает snapshot).
- **Доказательство:** `replied.current = true` выставляется ДО onReply; если onReply падает (сеть/сервер), экран восстанавливает questions — QuestionPrompt рендерится с тем же request id в той же позиции → component reuse → `replied.current` остаётся true → все тапы игнорируются навсегда (до пере-входа на экран).
- **Ожидание:** после провала юзер может повторить; **Факт:** кнопки заморожены.
- **Фикс:** сбрасывать `replied.current` через useEffect при смене `request.id`… но id тот же: нужно клонировать mount key (например, `key={request.id + ":" + attempt}` в месте рендера, увеличивая attempt при rollback) или хранить replied в состоянии экрана.

### BUG-020 — после re-lock биометрия не предлагается автоматически
- **Где:** `src/components/AuthGate.tsx:21-26`; re-lock из `app/_layout.tsx:60-67` (`lock()` при уходе в background).
- **Доказательство:** auto-биометрия — `useEffect(..., [])` — только при монтировании. После `lock()` (возврат приложения из фона) AuthGate остаётся смонтированным: показывает ручной «Unlock», авто-промпта нет. Комментарий в коде обещает «when the lock screen appears» — фактически «once per process».
- **Ожидание:** consistent с обещанием: промпт при каждом появлении lock screen; **Факт:** только cold start.
- **Фикс:** `useEffect(() => { if (!isAuthenticated && settings.requireBiometric) authenticate() }, [isAuthenticated])`.
- Комментарий: возможно сознательный выбор, но противоречит комментарию.

### BUG-021 — провалившийся switch model/agent запоминается как успешный
- **Где:** `src/lib/sdk.ts:532-557, 587`.
- **Доказательство:**
  ```ts
  await request(config, `…/model`, {...}).catch(() => undefined) // tolerate switches failing
  …
  lastSwitch.set(sessionID, switchKey)
  ```
  Оба POST едят свои ошибки; `lastSwitch.set` — безусловный. Провалившийся switch становится «уже сделанным»: следующие prompt не переотправят switch → ран пойдёт со старой моделью/агентом, хотя чип показывает новую.
- **Ожидание:** set только после успешного switch; **Факт:** переключение теряется втихую.
- **Фикс:** хранить lastSwitch только при ОК (или в await POST ошибку не глотать, а транслировать в результат prompt).

## LOW

### BUG-022 — Stop недоступен, если набран текст/вложение (+ mic недоступен при isSending)
- **Где:** `app/session/[id].tsx:920-937`.
- **Доказательство:** `{isSending && !input.trim() && attachments.length === 0 && !speech.listening &&(<StopBtn>…)}` — юзер, набравший follow-up во время рана, не может его прервать. Аналогично mic-кнопка спрятана при isSending — желание «сейчас скажу голосом» не обработать.
- **Фикс:** StopBtn показывать при `isSending && !speech.listening` независимо от input (место рядом с SendsBtn — уже есть пустые квадраты), mic — разрешить параллельно.

### BUG-023 — PermissionPrompt без защиты от double-tap
- **Где:** `src/components/chat/PermissionPrompt.tsx:22-32` + обработчик в `app/session/[id].tsx`.
- **Доказательство:** три кнопки без disabled/guard; оптимизм remove асинхронен — двойной тап («Allow» затем «Always») посылает два reply-запроса, второй обычно 404/400 → alert.
- **Фикс:** локальный `replied` ref (как в QuestionPrompt) или `disabled` после первого onPress.

### BUG-024 — Речь: язык хардкод en-US; start() не await; permission-ошибка не переведена
- **Где:** `src/lib/speech.ts:55-66`.
- **Доказательство:** `ExpoSpeechRecognitionModule.start({ lang: "en-US", … })` — при русском интерфейсе распознавание en-профиль; `start(...)` без await (модуль возвращает Promise — ошибки старта молча в unhandled); `"Microphone permission denied"` (:58) — захардкоден en.
- **Фикс:** брать язык из i18n (или устройство), await start + setError на reject, эм-строку заменить на t().

### BUG-025 — захардкоженные EN-строки в постоянных местах UI
- **Где:** `src/components/chat/MessageBubble.tsx:83` (`{isUser ? "You" : "Assistant"}` и `:167` `tokens`), `src/components/markdown/CodeBlock.tsx:28` (`copied ? "Copied!" : "Copy"`), `src/stores/auth.ts:89-91` и `:119` (системные промпты биометрии, крошатся на системном языке).
- **Фикс:** использовать t() ключи (в i18n-паритете — добавить тесты parity уже есть: `catalog-parity.test.ts`).

### BUG-026 — UpdateBanner списывает баннер раньше, чем открывается страница
- **Где:** `src/components/UpdateBanner.tsx:40-46`.
- **Доказательство:** `onOpen`: `void dismissUpdate(...)` (маркированной seen) выполняется ДО `void Linking.openURL(...)` — если openURL fail (нет браузера), баннер уже снят и «версия помечена известной» → пользователь не сможет вернуть баннер без переустановки. `openURL` rejection — unhandled promise.
- **Фикс:** `const ok = await Linking.openURL(...).catch(() => false)`; dismiss только по ok; + warning при fail.

### BUG-027 — SlashPopover: дубли trigger и конфликтные keys
- **Где:** `app/session/[id].tsx:183-199` (`[...custom, ...builtins]` без дедупликации) + `src/components/chat/SlashPopover.tsx:33-54` (`key={cmd.trigger}`).
- **Доказательство:** серверная команда `undo`/`model`/`compact` и builtin-одноимённая дадут две строки; FlatList warning давления keys.
- **Фикс:** дедуплицировать с приоритетом builtin (или custom?) — в handleSend builtin проверяется первым (`:525-527`), значит «эквивалентный» custom все равно недостижим — надо приоритет builtin и фильтровать дубли.

### BUG-028 — prune: ранний выход пропускает toolInputs/toolNames/reasoningAccum
- **Где:** `src/lib/v2-compat.ts:737-752`.
- **Доказательство:**
  ```ts
  private prune() { if (this.assistants.size <= MAX_TRACKED && this.textAccum.size <= MAX_TRACKED) return …
  ```
  при большоч длинной сессии (масс-тулы, но ≤400 сообщений) `toolInputs/toolNames/reasoningAccum` не обрезаются никогда — медленная утечка на live-соединении.
- **Фикс:** включить все 5 карт в условие/пере-обрезку.

### BUG-029 — notifications dedupeSentAt не ограничен
- **Где:** `src/lib/notifications.ts:79, 140-146`.
- **Доказательство:** ключи `question-<id>`, `permission-…`_ackMap растёт только. Мелкое потребление памяти на долгих сессиях.
- **Фикс:** удалять запись после истечения cooldown.

### BUG-030 — store-review: повреждённый счётчик = NaN навсегда
- **Где:** `src/lib/store-review.ts:54`.
- **Доказательство:** `Number(storedCount ?? "0")` — если в SecureStore битое значение (не число), count=NaN; `String(NaN)` сохранится обратно → всегда NaN → prompt никогда не вызовется.
- **Фикс:** `const parsed = Number(...); const count = Math.min(Number.isFinite(parsed) ? parsed + 1 : 1, …)`.

### BUG-031 — SessionInfo: строки сжатия числовых колонок — переполняются при нешпре мониторов
- **Где:** `src/components/chat/SessionInfo.tsx` (строки costRow/label — см. связанное) — мелкий cosmetic: Text с большим числом выталкивает соседей; добавить flexShrink:1 и numberOfLines.
- Примечание: числа (cost/ nevertheless токены) вовсе чистые — было проверено, NaN-режиссур не фиксируется.

### BUG-032 — messageData пересобирается на каждый входящий токен (плавность чата)
- **Где:** `app/session/[id].tsx:211-221` (динамически в memo — после этогорифма `deps=[messages, parts, revertMessageID]`; parts ломается на каждый delta).
- **Доказательство:** на каждый delta events → стан store обновляет `parts` → memo пересчитывает `[...терь all map reverse]` → создаётся новый массив items для ВСЕХ сообщений → FlatList diff на весь чат. Преждевременная оптимизация у MessageBubble мемом частично спасает, но data-пересборка всё равно на каждом токе.
- **Фикс:** вытянуть parts-merge в неизменяемых сущностях (не пересобирать items, если сравнение слабое — item parts не менялись) или накапливать только streamинг-сообщение.
- Влияние: производительность чата на длинных ответах.

### BUG-033 — повторный started не чистит textAccum/reasoningAccum
- **Где:** `src/lib/v2-compat.ts:484-519`.
- **Доказательство:** `session.text.started` регистрирует новую ординату, но НЕ очищает старые аккумуляторы той же пары (messageID|ordinal) — если сервер шлёт повторный started для той же ординаты (replay/rollback), old текст останется сцеплен с новым. Поведение реального сервера не установлено — SAFE-фикс: при started перезаписывать accum пустотой.
- **SUSPECT S(Server contract)**: подтвердить по логам V2-сервера, шлёт ли сервер repeat started.

---

## SUSPECT (требует проверки; не включены в сводную нумерацию)

### S-1 — jump-to-top: `scrollToEnd` на inverted FlatList (Android)
- `app/session/[id].tsx:716-720` — кнопка «в начало» вызывает `scrollToEnd({animated:true})` на инвертированном списке; известный RN-зоопарк вокруг scrollToEnd + inverted (react-native#17816): на Android может прыгнуть неправильно. 
- **Проверка:** устройство Android, длинный чат → SessionInfo → «Scroll to top» → должен прыгнуть к САМОМУ старому сообщению. Надёжная альтернатива: `scrollToOffset({offset: contentSize — высота}, …)` или `scrollToIndex({index: data.length-1, viewPosition:0})`.

### S-2 — Prompt files: `{ uri, name }` может не соответствовать контракту V2
- `src/lib/sdk.ts:563-568` — files в POST /api/session/{id}/prompt передаются как `{uri: file.url, name: file.filename}`. Серверные сообщения парсятся обрато (`mapMessage` ждаёт `data.base64`/`source.path`); систематическая сверка с `/openapi.json` живого сервера не проводилась.
- **Проверка:** отправить сообщение с вложением на реальный сервер V2 и сравнить body с ожиданиями openapi (`type/mime/url` vs `{uri,name}`); проверить, что аттачмент-предпросмотр исчезает на новом сообщении и в чат приходят картинки.

### S-3 — какое событие V2 шлёт для интерактивных вопросов
- Нужна выборка по живому серверу (`/api/event` sniff при вопросе модели) для точного фикса BUG-004.

### S-4 — «Синхронизация чипа модели» может переписывать только что выбранный вариант
- `app/session/[id].tsx` (эффект на messages.length — читать latest assistant message, полученный из server-keep) — редкий переход (reconcile пред-password), у нему вопрос-SUSPECT (перезапись чипа если юзер только выбрал вариант до reconcile). Проверка на устройстве против прерывистого соединения.

---

## Отброшенные ложные срабатывания (чтобы не возвращаться)

- SessionInfo численные поля — NaN не достижим (cost/tokens гайдируется `>0`), форматирование Intl ок.
- settings.tsx «async в render» — на деле это handler `onValueChange` (`:100`), не render.
- Таймеры чата чистятся; ToolCallCard/UpdateBanner флекс — ок; memo-компаратор MessageBubble корректен; reconnect-цикл без двойного schedule; `selectSession`	seq-guard есть.
- message-merge FIFO pairing корректен; баг только в паре с/failed send (BUG-009) и temp-id коллизии (BUG-018).
