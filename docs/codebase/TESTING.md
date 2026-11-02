# Тестовые практики

## Обязательные разделы

### 1) Стек тестов и команды

- Основной фреймворк: **встроенный `node:test`** (без Jest/Vitest), запуск через `scripts/run-tests.mjs` на Node.js 24 с нативным type-stripping (отдельной сборки/транспиляции тестов нет).
- Ассерты: `node:assert/strict`.
- Оркестрация: скрипт сам собирает файлы (`src/**/*.test.ts` + `scripts/*.test.mjs`), сортирует, передаёт явными аргументами и **падает с кодом 1, если файлов не найдено** — защита от «0 тестов = успех» (`scripts/run-tests.mjs:1-15`).
- Вспомогательные инструменты в тестах: `node:module` `registerHooks` (подмена `expo/fetch`), `node:vm` + пакет `typescript` (рендер экранов с детерминированными адаптерами), `readFileSync` (статический анализ исходников).
- Команды:

```bash
npm test                 # все тесты (565 тестов, 71 файл на 5837958)
npm run test:coverage    # то же + пороги 80 % (lines/branches/functions)
npm run typecheck        # tsc --noEmit (тестовые файлы исключены)
npm run check:versions   # паритет версий
```

- Локальные прогоны 2026-11-03:
  - на коммите `5837958` (чистое дерево): `tests 565 / pass 565 / fail 0`, длительность ≈ 33 с; покрытие **98.65 % строк, 85.83 % ветвей, 96.02 % функций** — пороги 80 % пройдены.
  - на рабочем дереве с незакоммиченными правками владельца репозитория (`src/stores/events.ts`, новые `src/lib/answered-questions.ts` и `src/components/chat/AnsweredQuestion.tsx`): `tests 574 / pass 574 / fail 0`, длительность ≈ 55 с (73 файла: 72 `.test.ts` в `src/` + 1 `.test.ts.mjs` в `scripts/`).
  - Тесты используют реальные таймеры (`node:vm` + sleep-ы в сотни миллисекунд), поэтому под параллельной нагрузкой на машине падают по таймауту без изменения кода — один прогон под нагрузкой дал 12 падений в `src/lib/session-run-resync.test.ts`, повторный прогон тех же файлов в одиночку и полный `npm test` — зелёные. Перед выводом «тесты красные» перепроверять в простое.

### 2) Раскладка тестов

- Размещение: **рядом с модулем** — `src/lib/<name>.test.ts` для `src/lib/<name>.ts`; два компонентных теста лежат в `src/components/` (`src/components/chat/diff-compute.test.ts`, `src/components/wide-content-scroll.regression.test.ts`).
- Количество: 70 `.test.ts` в `src/` + 1 `.test.mjs` в `scripts/` (`scripts/run-tests.test.mjs`) = 71 файл на коммите `5837958`; в рабочем дереве на 2026-11-03 — 72 `.test.ts` в `src/` (добавлены тесты к новым незакоммиченным модулям).
- Именование: `<модуль>.test.ts`; регрессии получают суффикс `.regression.test.ts` (`src/lib/dialog-back-gesture.regression.test.ts`), smoke/integration — `.smoke.test.ts` / `.integration.test.ts` (`src/lib/providers-screen.integration.test.ts`, `src/lib/sdk.integration.test.ts`).
- Исключение из правила имени: `src/lib/session-recency.test.ts` тестирует `src/lib/session-grouping.ts`.
- Setup-файлов и глобальных хуков нет: каждый тест сам поднимает нужное окружение (`before`/`after` в `src/lib/sdk.integration.test.ts:44-53 (server)`).
- Отдельно от `npm test`: CUA smoke `scripts/cua-roadmap-smoke.mjs` запускается только в CI на эмуляторе (`.github/workflows/build.yml:188-197`).

### 3) Матрица охвата

| Область | Покрыто | Типичная цель | Заметки |
|---------|---------|----------------|---------|
| Unit (чистая логика) | да, основное | `src/lib/*.ts`: `v2-compat`, `message-run`, `part-runs`, `session-*`, `watchdog'и`, `offline-history`, `update-check-policy` | Большинство файлов `src/lib` имеют 100 % строк |
| Интеграционные HTTP | да, частично | `src/lib/sdk.integration.test.ts` (реальный loopback-сервер + подмена `expo/fetch`), `src/lib/session-list.integration.test.ts` (HTTP-фикстура) | Проверяются заголовки, пути, коды, отсутствие таймаута на prompt |
| Компонентные (рендер) | да, через харнесс | `src/lib/connections-screen.test.ts`, `src/lib/models-screen.test.ts`, `src/lib/providers-screen.integration.test.ts`, `src/lib/provider-connect-screen.smoke.test.ts` | Настоящий компонент исполняется в `vm` с фейковыми RN/Expo/zustand-адаптерами |
| Статические инварианты | да | `src/lib/security-baseline.test.ts`, `src/lib/persisted-keys.test.ts`, `src/lib/keyboard-inset.test.ts` (часть), `src/lib/dialog-back-gesture.regression.test.ts`, `wide-content-scroll.regression.test.ts`, `src/lib/session-isolation.test.ts` | Регулярки по исходникам: проверяют то, что нельзя отрендерить |
| E2E на устройстве | только в CI | `scripts/cua-roadmap-smoke.mjs` | Релизный APK + UIAutomator на эмуляторе API 35; в `npm test` не входит |
| Тесты против живого `opencode serve` | нет | — | Все тесты работают с заглушками; реальный сервер вручную не проверялся (`HANDOFF.md:68`) |

### 4) Моки и изоляция

- Основной подход: **внедрение зависимостей** вместо модульного мокинга. Чистые модули принимают хранилище/`fetch`/таймеры параметрами: `createHistory(storage)` (`src/lib/offline-history.ts:30 (createHistory)`), `ChatwootDeps.fetchFn` (`src/lib/chatwoot.ts:17-21 (ChatwootDeps)`), `createPartBatcher(key, flush, delayMs)` (`src/lib/part-batch.ts:16-20 (createPartBatcher)`), `createTunnelConnector(dependencies)` (`src/lib/tunnel.ts`).
- Сетевой уровень: `registerHooks` подменяет только `expo/fetch` на глобальный `fetch`, дальше SDK работает по-настоящему (`src/lib/sdk.integration.test.ts:1-17`); сервер поднимается на `127.0.0.1:0` и пишет все вызовы в массив `calls` для ассертов.
- HTTP-фикстура: `tests/fixtures/mock-opencode-server.ts` — минимальный сервер, но он реализует **V1-протокол** (`/session`, `/experimental/session`, `/global/event`, `prompt_async`) и используется только `session-list.integration.test.ts`.
- UI-уровень: харнесс исполняет код экрана через `typescript.transpileModule` + `vm.runInNewContext`, подсовывая управляемые `useState`/`useEffect`/`useFocusEffect`, фейковые сторы и навигацию (`src/lib/connections-screen.test.ts:1-30`). Так проверяется поведение (например, «Активно» появляется только после ответа сервера).
- Хранилище: in-memory реализации интерфейса `Storage`/`QueueStorage` (`src/lib/offline-history.ts` типы, `src/lib/waitlist-queue.test.ts:18`).
- Изоляция: глобального состояния между тестами нет — `beforeEach` сбрасывает переменные (`src/lib/sdk.integration.test.ts:53 (prompt)`), стораджи создаются внутри теста; таймеры в батчере управляются через переданный `delayMs`.
- Частая ловушка: тест, читающий исходник регуляркой, ломается при рефакторинге формата (например, `cancelable: true` в `src/lib/dialog-back-gesture.regression.test.ts`), а не поведения — при правке таких файлов сохраняйте ожидаемый текстовый маркер осознанно.

### 5) Покрытие и сигналы качества

- Инструмент: встроенный `--experimental-test-coverage`; пороги: 80 % строк / ветвей / функций; исключены `tests/**` и сами тесты (`package.json:14`).
- Текущее покрытие: 98.65 / 85.83 / 96.02 (all files).
- Замер на коммите `5837958`. Наиболее «дырявые» модули по ветвям: `src/lib/v2-compat.ts` — 68.13 % ветвей (94.85 % строк), `src/lib/sdk.ts` — 82.61 % ветвей (99.63 % строк). Именно там живут непроверенные ветки протокола.
- Гейт в CI: job `test` выполняет `npm run check:versions` → `npm run typecheck` → `npm run test:coverage` (`.github/workflows/build.yml:32-39`), и только затем `build`.
- Известные пробелы: (1) `*.test.ts` исключены из `tsconfig.json`, поэтому `npm run typecheck` **не проверяет типы тестов**; (2) нет тестов против живого сервера; (3) фикстура `tests/fixtures/mock-opencode-server.ts` описывает V1-протокол, которого приложение уже не использует.

### 6) Evidence

- `package.json` (`scripts.test`, `scripts.test:coverage`)
- `scripts/run-tests.mjs`
- `scripts/run-tests.test.mjs`
- `scripts/cua-roadmap-smoke.mjs`
- `.github/workflows/build.yml`
- `tsconfig.json`
- `src/lib/sdk.integration.test.ts`
- `src/lib/session-list.integration.test.ts`
- `tests/fixtures/mock-opencode-server.ts`
- `src/lib/connections-screen.test.ts`
- `src/lib/security-baseline.test.ts`
- `src/lib/persisted-keys.test.ts`
- `src/components/wide-content-scroll.regression.test.ts`
- `src/lib/dialog-back-gesture.regression.test.ts`
- `src/lib/keyboard-inset.test.ts`
- `docs/codebase/.codebase-scan.txt`
