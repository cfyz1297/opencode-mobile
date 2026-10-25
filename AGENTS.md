# OpenCode Mobile — AGENTS.md

Форк `cfyz1297/opencode-mobile`: Expo/React Native Android-клиент к собственному серверу `opencode serve` (V2 API). Приложение не публикуется в магазинах — только APK через GitHub Releases. Текущее состояние, версия и порядок релиза: [HANDOFF.md](HANDOFF.md). Уроки прошлых задач: [.agents/retro.md](.agents/retro.md).

## Карта проекта

```
app/                 # Expo Router: (tabs)/sessions|connections|settings, session/[id], connection/, models, providers/, history, demo
src/lib/             # SDK (sdk.ts), адаптер V2→V1 (v2-compat.ts), чистая логика + её тесты рядом (*.test.ts)
src/stores/          # zustand: sessions, connections, events (SSE), catalog, settings, auth, model-visibility
src/components/      # UI: chat/, markdown/, AuthGate, TabletSessions, UpdateBanner
android/             # prebuild-вывод, подпись и сборка релиза (gradlew assembleRelease)
scripts/             # run-tests.mjs, check-version-parity.mjs, cua-roadmap-smoke.mjs
docs/                # только отчёты о текущих проверках (security, статус подключения, видимость моделей)
```

## Команды

```bash
npm run check:versions   # app.json ↔ package.json ↔ android/app/build.gradle
npm run typecheck
npm test                 # node --test через scripts/run-tests.mjs
npm run test:coverage    # пороги 80% по строкам/ветвям/функциям
npm run android          # dev-сборка на устройстве/эмуляторе
```

Перед ответом «готово» прогонять `check:versions`, `typecheck`, `test:coverage`. Windows/PowerShell портит glob-ы — запускать тесты только через `npm test`/`run-tests.mjs`.

## Правила работы

- Новая функция или багфикс — сначала падающий тест (RED), потом минимальный фикс (GREEN). UI-тесты для экранов запускают настоящий компонент с детерминированными адаптерами RN (образец: `src/lib/connections-screen.test.ts`).
- Чистую логику выносить в `src/lib/*.ts` без импортов RN/SDK, чтобы тестировать обычным `node --test`.
- Секреты никогда не попадают в код, тесты, логи и коммиты. Пароли серверов — только SecureStore с `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- Ответы сервера не рендерить как разметку и не логировать; в UI — фиксированные ключи переводов (en/ru/zh-Hans, паритет проверяется тестом).
- Fail-closed: недоступность, ошибка сети и не-2xx трактуются как «сервер недоступен», а не как успех.
- Стиль: `const`, ранние возвраты, без `any`, без лишних абстракций.

## Git и CI

- Git требует разового `git -c safe.directory=E:/ai/opencode-mobile ...`.
- `gh` CLI не авторизован: `git credential fill` → токен → REST API (dispatch, artifacts, merge, releases, uploads.github.com).
- UTF-8 JSON для REST собирать в `node` и отправлять `Invoke-RestMethod -InFile`: PowerShell `ConvertTo-Json` ломает кириллицу.
- Активны только workflow `Build Android APK` и `Security scan`. Всё остальное (магазины, iOS, Maestro) из проекта удалено.
- `dist/` — локальные APK, в Git не попадают.
