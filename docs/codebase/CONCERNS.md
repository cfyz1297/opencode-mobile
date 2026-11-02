# Проблемные места кодовой базы

Состояние зафиксировано 2026-11-03 на коммите `5837958` (`main`, версия 0.2.28 / 62). В рабочем дереве на момент написания были незакоммиченные правки (`git status`: `app/session/[id].tsx`, `src/stores/events.ts`, каталоги i18n, новые `src/lib/answered-questions.ts` и `src/components/chat/AnsweredQuestion.tsx`) — они учтены там, где указаны номера строк. Всё ниже — по факту кода и локальных прогонов, не по README.

## Обязательные разделы

### 1) Главные риски (по приоритету)

| Severity | Проблема | Evidence | Влияние | Что делать |
|----------|----------|----------|---------|------------|
| high | CI-проверка подписи/версии собираемого APK ходит в сеть за **предыдущим релизом** (`releases/latest/download/opencode-mobile-v2.apk`) | `.github/workflows/build.yml:147-155` | Если последний релиз переименован/удалён или GitHub отдаёт ошибку, сборка падает; релизный конвейер зависит от состояния публичного канала | Кэшировать сертификат/отпечаток в секрете вместо скачивания APK, либо сделать шаг некритичным |
| high | Версия захардкожена в **четырёх** местах, четвёртое — grep внутри workflow | `.github/workflows/build.yml:144-146`, `scripts/check-version-parity.mjs:14-30 (errors)` | `check:versions` проверяет три файла, а `versionCode='62'`/`versionName='0.2.28'` в workflow нужно править руками; забыл — красный CI на теге или, хуже, рассинхрон метаданных | Читать версию из `app.json` в workflow (`jq`/node), убрать литералы |
| med | Тесты опираются на реальные таймеры (sleep-ы в сотни мс, `node:vm`-рендер), поэтому под параллельной нагрузкой падают по таймауту без изменения кода: прогон под нагрузкой дал 12 падений в `src/lib/session-run-resync.test.ts`, в одиночку и полным `npm test` — 574/574 pass | локальные прогоны `npm test` 2026-11-03 | Ложные «красные» прогоны; риск, что CI-агент с медленным диском сочтёт ветку сломанной | Поднять таймауты через `--test-timeout` в `scripts/run-tests.mjs` или перевести на инъекцию таймеров (`mock.timers`) |
| high | Тестовые файлы исключены из `tsc` — типы тестов не проверяются | `tsconfig.json:9-10`, `package.json:11` | Ошибка типов в тесте (изменилась сигнатура модуля) не ловится `npm run typecheck`; тест может упасть только в рантайме | Отдельный `tsconfig.test.json` + шаг `tsc -p` в CI |
| med | HTTP-фикстура и «интеграционный» тест списка сессий описывают **V1-протокол**, которого приложение уже не использует | `tests/fixtures/mock-opencode-server.ts:10-46`, `src/lib/session-list.integration.test.ts:36-50 (realTransport)` | Тест зелёный, но не проверяет реальный путь (`/api/session`); создаёт ложную уверенность в покрытии списка сессий | Переписать фикстуру на V2 (`/api/*`) или явно помечать тест как legacy |
| med | Мёртвый production-код: `loadSessionList`/`SessionListTransport`/`legacySessionQuery` не вызываются ни из `app/`, ни из сторов | `src/lib/session-list.ts:19-70 (SessionListTransport)` (grep: только тесты) | Поддержка двух транспортных моделей списка сессий, путаница «какой путь настоящий» | Удалить `loadSessionList`+`legacySessionQuery`, оставить чистый `normalizeSessions` (он используется в `src/lib/sdk.ts:340 (createClient)`) |
| med | Крупные экраны смешивают вёрстку, состояние и обработку протокола | `app/(tabs)/index.tsx` (1546 строк), `app/session/[id].tsx` (1389), `app/connection/add.tsx` (947) | Высокая цена изменений, конфликты, регрессии при правке чата | Выносить обработчики/селекторы в `src/lib` по образцу `message-run.ts`, `part-runs.ts` |
| med | Файлы > 500 строк с несколькими ответственностями (не только экраны) | `src/lib/v2-compat.ts` (1010), `src/lib/sdk.ts` (814), `src/stores/events.ts` (648), `src/stores/sessions.ts` (595) | Протокол и транспорт в одном модуле: сложно менять одно, не задев другое | Разделить `v2-compat.ts` по доменам (сессии / сообщения / события / каталоги); в `sdk.ts` вынести SSE в отдельный модуль |
| med | `npm audit --omit=dev`: 34 уязвимости (7 high, 26 moderate, 1 low) в сборочной цепочке | локальный прогон 2026-11-03; `README.md:88` заявляет 11 | Уязвимости исполняются на CI-раннере, не в APK; риск — компрометация сборки | Обновлять Expo/Metro при возможности; зафиксировать политику «не `audit fix --force`» (ломает Expo 54) |
| med | Биометрический лок можно обойти, если процесс не убит, но приложение вернулось из фона | `app/_layout.tsx:92-108 (RootLayout)`, `src/stores/auth.ts:146-148 (lock)` | Заблокировано: лок ставится на `AppState === "background"`, но НЕ на `"inactive"` (осознанно) — при некоторых сценариях переключения задачи экран может остаться открытым | Ручная проверка на устройстве; при необходимости — таймаут бездействия |
| low | `global.health()` считает отсутствующий `healthy` за `true`, а `probeConnection` требует строго `true` | `src/lib/sdk.ts:348-351 (health)`, `src/lib/connection-health.ts:17 (probeConnection)` | Две разные семантики «здоровья»: SDK fail-open, проверка статуса fail-closed | Привести к одному правилу (fail-closed) и покрыть тестом |
| low | 401/403 показывается как «Сервер недоступен» в бейдже статуса | `src/lib/connection-health.ts:15-20 (probeConnection)`, `HANDOFF.md:69`, `docs/security-review-0.2.21.md:30` | Пользователь не понимает, что дело в пароле | Отдельное состояние «неверный пароль» |
| low | Заголовки уведомлений захардкожены по-английски, вне i18n | `src/stores/events.ts:456,530,550,592` | На ru/zh уведомления на английском; нарушает правило `AGENTS.md` о фиксированных ключах | Перенести тексты в каталоги (нужен способ передать `t` в модуль уведомлений) |

### 2) Технический долг

Маркеров долга в production-коде почти нет: скан находит ровно **один** `TODO` (`src/components/chat/MessageBubble.tsx:42 (Props)` — замена на streamdown-rn), `FIXME`/`HACK` отсутствуют. Реальный долг описан ниже.| Долг | Почему существует | Где | Риск если игнорировать | Предлагаемое исправление |
|------|-------------------|-----|------------------------|--------------------------|
| Нет линтера/форматтера | Исторически полагались на `tsc` + тесты | весь репозиторий (нет `.eslintrc*`, `.prettierrc*`) | Стилевой разнобой (двойные/одинарные кавычки, `;` в `scripts/`), «мертвые» импорты ловятся только глазами | ESLint + Prettier как отдельный необязательный шаг, не ломающий CI |
| `@/*` алиас объявлен и не используется | Наследие шаблона | `tsconfig.json:5-7` (0 импортов в `src`/`app`) | Ложное ожидание у нового участника | Либо использовать, либо удалить из tsconfig |
| `any` в 24 местах | Границы неполных внешних типов | `src/components/chat/ToolCallCard.tsx:347 (ToolCallCard)`, `src/stores/events.ts:156,398,469`, `src/lib/status-labels.test.ts:8 (part)` | Ослабление `strict` на стыках, ошибки формы событий | Уточнить типы событий/иконок, убрать касты |
| Остатки Sentry | Плагин удалён, файл остался | `android/sentry.properties` (org `vibetechnologies`, project `opencode-mobile`) | Путаница: выглядит как активная телеметрия | Удалить файл |
| Остатки F-Droid в Gradle | Комментарии и настройки сохранены после отказа от F-Droid | `android/app/build.gradle` (`enableV3Signing false`, `dependenciesInfo.includeInApk false`, комментарии про androguard/fdroidserver) | Сборка подписана только v1+v2; причина неочевидна новому участнику, удаление «мусора» сломает совместимость с уже опубликованным APK | Оставить, но заменить комментарии на актуальное объяснение (совместимость подписи с 0.2.x) |
| Дублирование семантики статуса сессии | Два источника: SSE-события и `/api/session/active` | `src/stores/events.ts:189-253 (resyncBusySessions)` | Сложно воспроизводимые баги «вечный busy» на старых серверах | Задокументировать контракт (частично сделано) и покрыть тестом на приоритет |
| Таймеры сверки после отправки | V2 не шлёт событие о user-сообщении | `src/stores/sessions.ts:387-393 (sendMessage)` (1.2 с и 4 с) | Лишние GET на каждое сообщение; на медленной сети сообщение может «мигнуть» | Серверное событие/оптимистичный merge по `id` вместо таймеров |
| `EX_DEV_CLIENT_NETWORK_INSPECTOR=true` в release-конфиге | Наследие шаблона prebuild | `android/gradle.properties` | Лишний dev-флаг в релизной конфигурации | Убрать/перенести в debug |

### 3) Безопасность

| Риск | OWASP | Evidence | Текущая мера | Пробел |
|------|-------|----------|--------------|--------|
| Пароль и переписка идут по plain `http://` | A02 Cryptographic Failures | `app.json:39` (`usesCleartextTraffic`), `src/lib/connection-security.ts:10-27 (sendsPasswordInClearText)` | Предупреждение в формах подключения; loopback/https не предупреждают | Запрета нет (осознанно для LAN/Termux); нет pinning/предупреждения при смене сертификата |
| `SYSTEM_ALERT_WINDOW` всё ещё объявлен в prebuild-манифесте | A05 Security Misconfiguration | `android/app/src/main/AndroidManifest.xml:5` | `app.json:40` `blockedPermissions` снимает его при `expo prebuild` | В репозитории нет автоматической проверки собранного манифеста; тест проверяет только `app.json` (`src/lib/security-baseline.test.ts:27-33 (read)`) |
| Хранение паролей/истории | A02 | `src/stores/connections.ts:19 (SECURE_OPTIONS)`, `src/lib/history-storage.ts:4-6 (offlineHistory)` | `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, инвариант закреплён тестом | Нет явного исключения из Android-бэкапа для JSON соединений (там нет секретов, но есть URL) |
| API-ключи провайдеров уходят на сервер | A04 Insecure Design (доверие к серверу) | `src/lib/sdk.ts:773-799 (list)` | Ключ не сохраняется клиентом, отправляется по аутентифицированному каналу | При http-соединении ключ виден в трафике |
| Ответы модели рендерятся как Markdown | A03 Injection (XSS-класс, ограничен RN) | `src/components/markdown/Markdown.tsx` | `react-native-marked` не исполняет HTML/JS; ссылки не открываются автоматически | Нет явного теста «HTML в ответе не становится активным» |
| Секрет Chatwoot попадает в сборочное окружение, хотя доставка выключена | A05 | `.github/workflows/build.yml:45`, `src/lib/diagnostics.ts:198-203 (CHATWOOT_SOURCE_KEY)` | Флаг `DIAGNOSTICS_SUPPORT_DELIVERY = false` | Мёртвая конфигурация: секрет и код живые, доставка — нет |
| Скачивание предыдущего APK в CI | A08 Software and Data Integrity | `.github/workflows/build.yml:147` | Сверка сертификата (`apksigner verify --print-certs`) | Артефакт не проверяется по хешу/подписи до сравнения (сравнение и есть проверка, но источник доверия — тот же GitHub) |
| Готовые диагностические отчёты содержат хост сервера | A09 Logging Failures (утечка) | `src/lib/diagnostics.ts:186-190 (appVersion)`, `src/lib/scrub.ts` | `redactHostAndUrls` перед отправкой/шарингом; буфер логов тоже чистится | `shareReport` показывает нередактированный текст пользователю (ожидаемо), но копируется он же в буфер — при пересылке вручную редактирования не будет |

### 4) Производительность и масштабирование

| Проблема | Evidence | Текущий симптом | Риск при росте | Предлагаемое улучшение |
|----------|----------|-----------------|----------------|------------------------|
| Полная переписка перезагружается без `limit` при `refreshMessages`/`loadOlderMessages` | `src/stores/sessions.ts:232,453` (комментарий «Fetch ALL messages»), `src/lib/sdk.ts:536-545 (messages)` | На длинных сессиях каждый реконнект/дожатие грузит весь тред | Трафик и память растут линейно; на мобильной сети — задержки | Использовать `limit` + пагинацию (сервер поддерживает), хранить окно |
| Дозагрузка переписки на каждый «тихий» прогон (раз в 12 с тишины на сессию) | `src/lib/run-watchdog.ts:18,31-40`, `src/stores/events.ts:349-381 (connect)` | Дублирующие GET при подвисшем прогоне | Несколько активных сессий = несколько полных тредов в полёте | Ограничить окно/батчить, использовать `?limit=` |
| Markdown перепарсивается на каждое обновление части | `src/components/chat/MessageBubble.tsx:42-43 (Props)` (TODO про streamdown-rn), `src/components/markdown/Markdown.tsx` | До 0.2.28 — полный фриз JS-потока при возврате из фона | Длинные ответы = дорогой ререндер | Батчинг уже внедрён (`src/lib/part-batch.ts`); следующий шаг — мемоизация блоков |
| Адаптер событий хранит состояние по 400 сообщений и чистит «по одному» | `src/lib/v2-compat.ts:607,950-976` | При длинных сессиях растёт память, очистка O(n) | На очень длинных сессиях — лишние аллокации | Ограничить по времени/сессии, не только по количеству |
| `FlatList` без `getItemLayout`, крупные бандлы экранов | `app/(tabs)/index.tsx`, `app/session/[id].tsx` | Прокрутка длинных списков может дёргаться | Планшеты/большие сессии | `getItemLayout`, вынос компонентов |
| Офлайн-история пишется в SecureStore чанками | `src/lib/offline-history.ts:9-13,80-96` | Запись раз в секунду при изменениях (`app/_layout.tsx:35-52 (RootLayout)`) | Частые операции с Keystore на слабых устройствах | Дебаунс уже есть (1 с); можно увеличить/писать только при простое |
| Health-probe каждые 15 с на вкладке Connections | `app/(tabs)/connections.tsx:14,134-153` | Нагрузка на сервер в Termux | Батарея/сеть при долгом открытии вкладки | Увеличить интервал или останавливать при бездействии |
| Переключение модели и агента идут последовательно перед промптом | `src/lib/sdk.ts:576-601 (prompt)` | Два round-trip подряд на первое сообщение с явным выбором | Задержка отправки | `Promise.all` для двух независимых POST |

Проверено обратное: основные «веерные» места уже распараллелены через `Promise.all` — `selectSession` (сессия + переписка, `src/stores/sessions.ts:186-189 (selectSession)`), `loadConnections` (проект + пути, `src/stores/connections.ts:142-145 (loadConnections)`), `useCatalog.load` (агенты + команды + провайдеры, `src/stores/catalog.ts:74-78 (load)`), `refreshPending` (permissions + forms, `src/stores/events.ts:134 (refreshPending)`), `resyncBusySessions` (переписка + active, `src/stores/events.ts:206-210 (resyncBusySessions)`).

Открытые неизвестные: поведение на реальном устройстве (клавиатура, resync после потери сети) — `[TODO]` до ручной проверки (`HANDOFF.md:68`); возможность iOS-сборки — `[TODO]`, конфигурация есть, сборка не проверялась.

### 5) Хрупкие / высокочастотные области

Индекс churn получен из `git log --since="90 days ago" --name-only`; в окно попадают все 101 коммит репозитория (история короче 90 дней).

| Область | Почему хрупкая | Сигнал churn | Как безопасно менять |
|---------|----------------|--------------|----------------------|
| `package.json` | Одновременно версия, зависимости, скрипты, expo-конфиг | 25 изменений | Менять версию только вместе с `app.json` и `android/app/build.gradle`, затем `npm run check:versions` |
| `app.json` | Версия + versionCode + permissions + plugins | 24 | После правки — `npx expo prebuild` и проверка манифеста |
| `android/app/build.gradle` | Подпись, versionName/Code, F-Droid-совместимость | 23 | Не трогать блок `signingConfigs` без проверки установки «поверх» |
| `app/session/[id].tsx` | Чат: поток, клавиатура, композер, реверт, вложения | 18 | Сначала тест в `src/lib/*`, потом правка экрана; прогонять `keyboard-inset` и `dialog-back-gesture` тесты |
| `.github/workflows/build.yml` | Версия, подпись, CUA, переиспользование сборки | 18 | Ветка workflow защищена scope токена (`gh` без `workflow`): правки — через обычные файлы или вручную |
| `src/lib/sdk.ts` | Все endpoint'ы, таймауты, V2-квирки | 14 | Любая правка — с HTTP-тестом в `src/lib/sdk.integration.test.ts` |
| `src/lib/i18n/*.json` | Три каталога, паритет ключей | по 10 каждый | Править все три сразу, иначе `catalog-parity` упадёт |
| `src/lib/v2-compat.ts` | Единственное место знания о V2-пейлоадах | 8 | Правка — только с тестом в `src/lib/v2-compat.test.ts` (68 % ветвей) |
| `scripts/cua-roadmap-smoke.mjs` | Зависит от UI-текстов, эмулятора и таймингов | 13 | Меняя тексты экранов, проверять сценарий smoke |

### 6) `[ASK USER]` вопросы

1. `[ASK USER]` Удалять ли мёртвый V1-путь списка сессий (`src/lib/session-list.ts`: `loadSessionList`, `SessionListTransport`, `legacySessionQuery`) и переписывать `tests/fixtures/mock-opencode-server.ts` на V2 — или оставить как страховку для старых серверов?
2. `[ASK USER]` Вводить ли ESLint + Prettier как обязательный гейт (сейчас стиль держится только ревью), и если да — какой набор правил считать базовым?
3. `[ASK USER]` Включать ли `*.test.ts` в проверку типов (`tsconfig.test.json` + шаг CI)? Сейчас `npm run typecheck` их не видит.
4. `[ASK USER]` Нужно ли вычищать `SYSTEM_ALERT_WINDOW` из закоммиченного `android/app/src/main/AndroidManifest.xml`, или достаточно `blockedPermissions` в `app.json` при prebuild?
5. `[ASK USER]` Остаётся ли доставка диагностики в Chatwoot продуктовой функцией (тогда включить `DIAGNOSTICS_SUPPORT_DELIVERY` и описать согласие), или её нужно удалить вместе с `EXPO_PUBLIC_CHATWOOT_INBOX_IDENTIFIER` из сборки?
6. `[ASK USER]` Удалять ли остатки Sentry (`android/sentry.properties`) и переписывать ли F-Droid-комментарии в `android/app/build.gradle`, или они нужны как объяснение текущей схемы подписи (v1+v2)?
7. `[ASK USER]` Обязателен ли сервер ≥ 2.0.24 (с `/api/session/active`), или поддержку старых серверов с эвристикой по переписке (`src/stores/events.ts:217 (resyncBusySessions)`) нужно сохранять?
8. `[ASK USER]` Кто и когда закрывает долг ручной проверки на устройстве (клавиатура, resync после потери сети, планшетный layout, туннель, офлайн-история) — см. `HANDOFF.md:68`?
9. `[ASK USER]` Переводить ли тексты уведомлений (сейчас захардкожены по-английски в `src/stores/events.ts`) на en/ru/zh-Hans, или уведомления намеренно только английские?
10. `[ASK USER]` Нужна ли iOS-сборка? `app.json` содержит полный iOS-блок и entitlements, а README утверждает, что iOS-сборки в форке нет (`README.md:77`).

### 7) Intent vs reality (расхождения документации и кода)

| Заявлено | Фактически | Evidence |
|----------|-----------|----------|
| «Sentry-загрузка source maps гейтится непустым `SENTRY_ORG`» (внешнее описание форка) | В workflow **нет** ни Sentry-плагина, ни шага source-map upload: Sentry полностью удалён из сборки; остался только неиспользуемый `android/sentry.properties` и комментарии | `.github/workflows/build.yml` (нет упоминаний), `metro.config.js:4-6`, `android/sentry.properties`, `README.md:74` |
| README: «в форке нет F-Droid» | В `android/app/build.gradle` сохранены F-Droid-специфичные настройки и комментарии (`enableV3Signing false`, `dependenciesInfo.includeInApk false`) | `README.md:54,77`, `android/app/build.gradle` |
| README/отчёт безопасности: «APK не запрашивает `SYSTEM_ALERT_WINDOW`» | В закоммиченном `AndroidManifest.xml` разрешение **присутствует**; снимается только на `expo prebuild` из `app.json` | `app.json:40`, `android/app/src/main/AndroidManifest.xml:5`, `docs/security-review-0.2.21.md:13` |
| README: «11 уязвимостей в сборочной цепочке» | `npm audit --omit=dev` на 2026-11-03: 34 (7 high, 26 moderate, 1 low) | `README.md:88`, локальный прогон |
| AGENTS.md: «без `any`» | 24 вхождения `as any`/`: any` в `src` + `app` | `src/stores/events.ts:156,398,469`, `src/components/chat/ToolCallCard.tsx:347 (ToolCallCard)` и др. |
| AGENTS.md: «в UI — фиксированные ключи переводов» | Заголовки уведомлений захардкожены по-английски | `src/stores/events.ts:456,530,550,592` |
| AGENTS.md/HANDOFF: сборка и git описаны для Windows (`E:/ai/opencode-mobile`, PowerShell, `Invoke-RestMethod`) | Репозиторий разрабатывается в Termux/Linux; тесты требуют Node 24 и запускаются через `npm test` | `AGENTS.md` («Git и CI», «Правила окружения»), `HANDOFF.md:84-86`, `scripts/run-tests.mjs` |
| HANDOFF: «Тесты 565 passed, typecheck чисто» | Подтверждено локально 2026-11-03: на коммите `5837958` — 565/565 pass, покрытие 98.65/85.83/96.02; на рабочем дереве с незакоммиченными правками — 574/574 pass (см. выше) | прогон `npm test`, `npm run test:coverage` |
| README: «Обновления проверяются, `releases/latest/download/opencode-mobile-v2.apk` используется встроенной проверкой» | Соответствует коду: `update-check.ts` ходит в GitHub Releases API, а CI проверяет подпись по тому же URL | `src/lib/update-check.ts:47-48 (RELEASES_API)`, `.github/workflows/build.yml:147` |
| README: «уведомления, офлайн-история до 20 сессий / 40 сообщений, планшет с 768 dp, две панели с 1000 dp» | Соответствует коду | `src/lib/offline-history.ts:69,82`, `src/lib/adaptive-layout.ts:1-5 (adaptiveLayout)` |
| AGENTS.md: «Активны только `Build Android APK` и `Security scan`» | Соответствует: в `.github/workflows/` ровно два файла, оба без publish-шагов | `.github/workflows/` |
| README: «CI собирает debug APK» (формулировка в сторонних описаниях) | Фактически собирается **release**-вариант (`assembleRelease`), подписанный production-ключом либо debug-ключом при отсутствии секрета; артефакт называется `app-release` | `.github/workflows/build.yml:84-108,158-163` |
| `.codebase-scan.txt`: «No security configs detected» | В репозитории есть gitleaks-workflow | `.github/workflows/security-scan.yml` |

### 8) Evidence

- `docs/codebase/.codebase-scan.txt` (TODO/FIXME, high-churn, top-10 largest files, CI-детект)
- `git log --since="90 days ago" --name-only` (churn-индекс, 101 коммит всего)
- `src/lib/session-list.ts`, `src/lib/sdk.ts`, `src/lib/v2-compat.ts`
- `src/stores/sessions.ts`, `src/stores/events.ts`, `src/stores/connections.ts`
- `app/(tabs)/index.tsx`, `app/session/[id].tsx`, `app/connection/add.tsx`
- `tests/fixtures/mock-opencode-server.ts`, `src/lib/session-list.integration.test.ts`
- `src/components/markdown/Markdown.tsx`, `src/components/chat/MessageBubble.tsx`
- `src/lib/offline-history.ts`, `src/lib/run-watchdog.ts`, `src/lib/stream-watchdog.ts`
- `.github/workflows/build.yml`, `.github/workflows/security-scan.yml`
- `tsconfig.json`, `package.json`, `app.json`, `android/app/build.gradle`, `android/app/src/main/AndroidManifest.xml`, `android/sentry.properties`, `android/gradle.properties`
- `README.md`, `README.ru.md`, `HANDOFF.md`, `AGENTS.md`, `docs/security-review-0.2.21.md`
- `src/lib/security-baseline.test.ts`, `src/lib/persisted-keys.test.ts`
