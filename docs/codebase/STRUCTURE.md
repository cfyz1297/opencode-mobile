# Структура кодовой базы

## Обязательные разделы

### 1) Карта верхнего уровня

| Путь | Назначение | Evidence |
|------|------------|----------|
| `app/` | Маршруты Expo Router (файл = экран): `(tabs)/` — sessions/connections/settings, `session/[id]`, `connection/*`, `providers/*`, `models`, `history`, `demo` | `app/_layout.tsx`, `AGENTS.md` (карта проекта) |
| `src/lib/` | Чистая логика + SDK + адаптер V2→V1; рядом с каждым модулем лежит `*.test.ts` | `src/lib/sdk.ts`, `src/lib/v2-compat.ts`, `src/lib/*.test.ts` |
| `src/stores/` | Zustand-сторы: `sessions`, `connections`, `events` (SSE), `catalog`, `settings`, `auth`, `model-visibility` | `src/stores/*.ts` |
| `src/components/` | UI-компоненты: `chat/` (пузыри, инструменты, промпты), `markdown/`, `AuthGate`, `ErrorBoundary`, `TabletSessions`, `UpdateBanner` | `src/components/` |
| `src/types/` | Локальные `.d.ts` для неполных типов сторонних пакетов | `src/types/expo-icons.d.ts`, `src/types/react-native-marked.d.ts` |
| `src/lib/i18n/` | Каталоги переводов `en.json`, `ru.json`, `zh-Hans.json` + конфиг i18next | `src/lib/i18n/config.ts` |
| `assets/` | Иконки, splash, adaptive-icon | `app.json:9-14,41-44` |
| `android/` | Результат `expo prebuild`: Gradle-проект, подпись, `MainActivity.kt` (IME-инсеты) | `android/app/build.gradle`, `android/app/src/main/java/cc/agentlabs/opencode/MainActivity.kt` |
| `plugins/` | Expo config-plugin для планшетного режима (снимает `screenOrientation`, добавляет `configChanges`) | `plugins/with-tablet-config-changes.js` |
| `scripts/` | `run-tests.mjs`, `check-version-parity.mjs`, `cua-roadmap-smoke.mjs`, `run-tests.test.mjs` | `scripts/` |
| `tests/fixtures/` | Единственный фикстур: `mock-opencode-server.ts` (HTTP-заглушка, V1-протокол) | `tests/fixtures/mock-opencode-server.ts` |
| `docs/` | Отчёты о текущих проверках (security, connection status, model visibility, run resync) + `docs/codebase/` (эта карта) | `docs/*.md` |
| `.github/workflows/` | Два активных workflow: `Build Android APK`, `Security scan` | `.github/workflows/*.yml` |
| `.agents/` | `retro.md` — уроки прошлых задач (читается перед работой) | `.agents/retro.md`, `AGENTS.md` |
| `dist/` | Локальные APK прошлых сборок, untracked, в Git не попадают | `.gitignore` (`dist/`), `AGENTS.md` |
| `node_modules/` | Зависимости, не документируется | `.gitignore` |

Верхнеуровневые документы: `README.md` (англ., основной), `README.ru.md`, `HANDOFF.md` (мастер-документ состояния/релиза), `AGENTS.md` (правила работы), `LICENSE` (MIT).

### 2) Точки входа

- Основная runtime-точка: `expo-router/entry`, заданная в `package.json:5` (`"main": "expo-router/entry"`).
- Корневой layout: `app/_layout.tsx` — здесь создаются `QueryClient`, `I18nextProvider`, `GestureHandlerRootView`, `BottomSheetModalProvider`, `AuthGate`, `ErrorBoundary`; здесь же инициализация auth/connections/settings, подписка на `AppState` (блокировка по уходу в фон), подключение SSE (`useEvents.connect()`), запуск `useCatalog.load()`, запрос разрешений на уведомления, автосохранение офлайн-истории (`app/_layout.tsx:35-157 (RootLayout)`).
- Вторичные входы:
  - нативная Activity: `android/app/src/main/java/cc/agentlabs/opencode/MainActivity.kt` (`getMainComponentName() = "main"`), с `installImeReporter()`;
  - CLI-скрипты в `scripts/` (тесты, паритет версий, CUA smoke);
  - deep link-схема `opencode://` (`app.json:7`, `android/app/src/main/AndroidManifest.xml` intent-filter).
- Как выбирается вход: Expo Router подхватывает `app/` автоматически; CI вызывает `npx expo prebuild` + `gradlew assembleRelease` (`.github/workflows/build.yml:80-108`).

### 3) Границы модулей

| Граница | Что здесь | Чего здесь быть не должно |
|---------|-----------|---------------------------|
| `app/**` (маршруты) | Композиция экранов: вёрстка, локальный UI-стейт, вызовы сторов | Бизнес-логика, парсинг API — выносится в `src/lib` (см. `AGENTS.md`: «Чистую логику выносить в `src/lib/*.ts` без импортов RN/SDK») |
| `src/lib/*.ts` (чистые модули) | Чистые функции/классы без RN и expo: `headers.ts`, `auth.ts`, `sse.ts`, `v2-compat.ts`, `part-batch.ts`, `run-watchdog.ts`, `session-list.ts`, `offline-history.ts` и др. | Импорты `react-native`, `expo-*`, `zustand` — иначе тесты под `node --test` не запустятся (комментарии в `src/lib/auth.ts:2-3`, `src/lib/api-error.ts:1-3`) |
| `src/lib/sdk.ts`, `src/stores/*` (интеграционный слой) | HTTP-клиент, SSE, транзитные сторы | Чистые вычисления, которые можно протестировать отдельно (они вынесены, напр. `session-list.ts`, `message-run.ts`) |
| `src/components/**` | Презентационные компоненты, `memo`, стили | Запросы к серверу напрямую (только через сторы/пропсы) |
| `src/stores/**` | Глобальное состояние + side effects (сеть, хранилище) | JSX, вёрстка |
| `android/**` | Prebuild-вывод, нативные правки (`MainActivity.kt`), подпись | Бизнес-логика приложения — она в JS |
| `tests/fixtures/**` | HTTP-заглушка для интеграционных тестов | Production-код |

### 4) Правила именования и организации

- Файлы в `src/lib`: **kebab-case** + домен (`run-watchdog.ts`, `message-merge.ts`, `part-batch.ts`, `connection-security.ts`), тест рядом: `<name>.test.ts` (например `src/lib/run-watchdog.test.ts`).
- Компоненты: **PascalCase** `.tsx` (`MessageBubble.tsx`, `ToolCallCard.tsx`, `DirectorySwitcher.tsx`); маршруты — по сегментам URL (`app/(tabs)/connections.tsx`, `app/session/[id].tsx`).
- Сторы: `src/stores/<домен>.ts`, экспорт `useXxx` (`useSessions`, `useConnections`, `useEvents`, `useCatalog`, `useSettings`, `useAuth`, `useModelVisibility`).
- Баррели: только два — `src/components/chat/index.ts` и `src/components/markdown/index.tsx`; остальное импортируется по прямому пути.
- Алиас `@/*` → `./src/*` объявлен в `tsconfig.json:5-7`, но **ни одного импорта через `@/` в коде нет** (проверено grep): фактическая конвенция — относительные пути.
- Тестовые файлы импортируют модули с явным расширением `.ts` (52 файла из 70), потому что Node 24 исполняет их type-stripping'ом (`src/lib/sdk.integration.test.ts:18 (resolve)`).
- Сгруппированная карта `src/lib` по назначению:
  - транспорт/протокол: `sdk.ts`, `sse.ts`, `v2-compat.ts`, `headers.ts`, `auth.ts`, `api-error.ts`, `directory-client.ts`, `provider-auth.ts`;
  - сессии и сообщения: `session-list.ts`, `session-grouping.ts`, `session-selection.ts`, `session-load-reconcile.ts`, `session-status-reconcile.ts`, `message-merge.ts`, `message-run.ts`, `part-batch.ts`, `part-runs.ts`, `prompt-from-parts.ts`, `revert-filter.ts`, `pending-questions.ts`, `question-answers.ts`;
  - живучесть/восстановление: `run-watchdog.ts`, `stream-watchdog.ts`, `connection-health.ts`;
  - UI-логика: `adaptive-layout.ts`, `keyboard-inset.ts`, `scroll-config.ts`, `scroll-follow.ts`, `model-selection.ts`, `model-picker-filter.ts`, `model-visibility.ts`, `providers-ui.ts`, `status-labels.ts`, `tablet-session-nav.ts`, `notify-format.ts`;
  - хранилище/безопасность: `offline-history.ts`, `history-storage.ts`, `connection-security.ts`, `scrub.ts`, `logbuffer.ts`, `persisted-keys.test.ts`;
  - внешнее: `update-check.ts`, `update-check-policy.ts`, `waitlist.ts`, `waitlist-queue-storage.ts`, `chatwoot.ts`, `diagnostics.ts`, `diagnostics-classify.ts`, `custom-provider.ts`, `tunnel.ts`, `speech.ts`, `speech-errors.ts`, `links.ts`, `file-roots.ts`, `path-utils.ts`, `quick-connect-url.ts`.

### 5) Evidence

- `package.json` (`main`, `scripts`)
- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/connections.tsx`, `app/(tabs)/settings.tsx`
- `app/session/[id].tsx`, `app/connection/add.tsx`, `app/connection/[id].tsx`, `app/connection/tunnel.tsx`, `app/models.tsx`, `app/history.tsx`, `app/demo.tsx`, `app/providers/*.tsx`
- `src/lib/`, `src/stores/`, `src/components/` (полные деревья получены `find`)
- `tests/fixtures/mock-opencode-server.ts`
- `android/app/src/main/java/cc/agentlabs/opencode/MainActivity.kt`
- `plugins/with-tablet-config-changes.js`
- `tsconfig.json`
- `docs/codebase/.codebase-scan.txt`
