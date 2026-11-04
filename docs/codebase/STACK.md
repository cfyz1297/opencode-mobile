# Технологический стек

Проект: форк `cfyz1297/opencode-v1-v2-mobile` — Expo/React Native клиент к self-hosted `opencode serve` (V2 API). Публикуется только как APK через GitHub Releases (`README.md:5`, `HANDOFF.md:4`).

## Обязательные разделы

### 1) Сводка по runtime

| Область | Значение | Evidence |
|---------|----------|----------|
| Основной язык | TypeScript / TSX: 145 `.ts` + 39 `.tsx` (по скану); плюс Kotlin (2 файла) для нативного Android-слоя | `docs/codebase/.codebase-scan.txt` (CODE METRICS), `android/app/src/main/java/cc/agentlabs/opencode/MainActivity.kt` |
| Runtime приложения | React Native 0.81.5 на Hermes, новая архитектура (`newArchEnabled=true`, `hermesEnabled=true`), Expo SDK 54 | `package.json:39,22`, `android/gradle.properties` |
| Runtime тестов / CI | Node.js 24 (нативное type-stripping для `.test.ts`) | `.github/workflows/build.yml:23-27`, `scripts/run-tests.mjs:13 (result)` |
| Пакетный менеджер | npm; lockfile v3; `legacy-peer-deps=true` | `package-lock.json`, `.npmrc`, `.github/workflows/build.yml:30` |
| Модульная система / сборка | Metro + `expo-router/entry` (JS), затем `expo prebuild` → Gradle `assembleRelease` (Android) | `package.json:5`, `metro.config.js`, `.github/workflows/build.yml:80-108` |
| Версия приложения | 0.2.28, versionCode 62 | `package.json:3`, `app.json:5,38`, `android/app/build.gradle:95-96` |

### 2) Продакшн-фреймворки и зависимости

Только высокоуровневые (полный список — `package.json:16-48`).

| Зависимость | Версия | Роль в системе | Evidence |
|-------------|--------|----------------|----------|
| `expo` | `^54.0.0` | Платформа, нативные модули, prebuild | `package.json:22` |
| `react-native` | `0.81.5` | UI-runtime, Hermes | `package.json:39` |
| `react` | `19.1.0` | UI | `package.json:37` |
| `expo-router` | `~6.0.22` | Файловый роутинг: `app/` = маршруты | `package.json:32`, `app/_layout.tsx` |
| `zustand` | `^5.0.2` | Все глобальные сторы (`src/stores/*`) | `src/stores/sessions.ts:1` |
| `@tanstack/react-query` | `^5.62.0` | `QueryClientProvider` в корне (единственное использование найдено) | `app/_layout.tsx:5,23,181` |
| `i18next` + `react-i18next` | `^26.3.6` / `^17.0.10` | Локализация en / ru / zh-Hans | `src/lib/i18n/config.ts` |
| `expo-secure-store` | `~15.0.8` | Пароли серверов, офлайн-история, настройки | `src/stores/connections.ts:2,19` |
| `@react-native-async-storage/async-storage` | `2.2.0` | Видимость моделей, проверка обновлений, очередь waitlist | `src/stores/model-visibility.ts:3`, `src/lib/update-check.ts:30` |
| `expo-notifications` | `~0.32.16` | Локальные уведомления (не push) | `src/lib/notifications.ts:89,153` |
| `expo-local-authentication` | `~17.0.8` | Биометрический AppGate | `src/stores/auth.ts:2` |
| `expo-image-picker`, `expo-image-manipulator` | `17.0.10`, `~14.0.8` | Вложения-изображения (JPEG + base64) | `app/session/[id].tsx:20-21`, `src/stores/sessions.ts:361 (sendMessage)` |
| `expo-speech-recognition` | `3.0.1` | Голосовой ввод | `src/lib/speech.ts`, `app.json:71-77` |
| `react-native-marked` | `8.0.0` | Рендер Markdown ответов модели | `src/components/markdown/Markdown.tsx:3` |
| `@gorhom/bottom-sheet` | `5.2.8` | Шиты (выбор модели/каталога, действия) | `app/_layout.tsx:7` |
| `react-native-reanimated`, `gesture-handler`, `screens`, `safe-area-context`, `worklets` | см. `package.json` | Анимации, жесты, навигация, инсеты | `package.json:40-46` |
| `react-native-svg`, `@expo/vector-icons` | `15.15.1`, `^15.0.3` | Иконки и графика | `package.json:45,17` |
| `expo-clipboard`, `expo-crypto`, `expo-device`, `expo-linking`, `expo-localization`, `expo-status-bar` | см. `package.json` | Буфер, UUID, инфо об устройстве, deep links, локаль, статус-бар | `package.json:23-36` |

Отсутствуют намеренно (удалены в форке): `@sentry/react-native`, PostHog, `expo-store-review` — см. `README.md:55,74,128` и `metro.config.js:4-6`.

### 3) Инструменты разработки

| Инструмент | Назначение | Evidence |
|------------|------------|----------|
| `typescript ~5.9.2` (`tsc --noEmit`, `strict: true`) | Проверка типов | `package.json:51,11`, `tsconfig.json:4` |
| `node:test` (встроенный) через `scripts/run-tests.mjs` | Тест-раннер; явный glob, отказ при нуле файлов | `scripts/run-tests.mjs:6-13 (files)` |
| `--experimental-test-coverage` с порогами 80 % | Покрытие строк/ветвей/функций | `package.json:14` |
| `scripts/check-version-parity.mjs` | Сверка версии в `package.json` ↔ `app.json` ↔ `android/app/build.gradle` | `scripts/check-version-parity.mjs:14-30 (errors)` |
| `scripts/cua-roadmap-smoke.mjs` | Android CUA smoke на эмуляторе (UIAutomator + фиктивный V2-сервер) | `scripts/cua-roadmap-smoke.mjs:1-10,104-131` |
| `gitleaks/gitleaks-action@v2` | Скан секретов в истории | `.github/workflows/security-scan.yml:28-31` |
| `@types/react ~19.1.10` | Типы React | `package.json:50` |

Линтера и форматтера в репозитории **нет**: файлов `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, `.editorconfig`, `.husky` не существует (проверено `ls`), соответствующих зависимостей и скриптов в `package.json` нет.

Контейнеров и оркестрации нет: `Dockerfile`, `docker-compose*`, `k8s/`, `Vagrantfile` отсутствуют (`.codebase-scan.txt`, секция CONTAINERS & ORCHESTRATION: «No containerization configs detected»); сборка идёт на раннере GitHub Actions с установленным Android SDK (`.github/workflows/build.yml:61-62`).

### 4) Ключевые команды

```bash
npm ci --legacy-peer-deps           # установка (как в CI)
npm start                           # Expo dev server
npm run android                     # dev-сборка на устройстве/эмуляторе (expo run:android)
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease   # релизный APK (в CI — build.yml:107-108)
npm test                            # node --test через scripts/run-tests.mjs
npm run test:coverage               # те же тесты + пороги 80 %
npm run typecheck                   # tsc --noEmit
npm run check:versions              # паритет версий в трёх файлах
```

Порядок перед релизом описан в `HANDOFF.md:71-80`: поднять версию в четырёх местах (`package.json`, `app.json` ×2, `android/app/build.gradle`), затем `check:versions` → tag `vX.Y.Z` → ручной GitHub Release с `opencode-mobile-v2.apk`.

### 5) Окружение и конфигурация

- Источники конфигурации: `app.json` (Expo-манифест, permissions, plugins), `tsconfig.json`, `metro.config.js`, `android/gradle.properties`, `android/app/build.gradle`, `plugins/with-tablet-config-changes.js`, `.npmrc`.
- Переменные окружения, реально читаемые кодом:
  - `EXPO_PUBLIC_CHATWOOT_INBOX_IDENTIFIER` — `src/lib/chatwoot.ts:29 (getChatwootConfig)`; в CI приходит из секрета `.github/workflows/build.yml:45`.
  - `EXPO_PUBLIC_CHATWOOT_BASE_URL` — `src/lib/chatwoot.ts:31 (getChatwootConfig)` (дефолт `https://support.agentlabs.cc`).
  - `RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD` — чтение в `android/app/build.gradle` (блок `signingConfigs.release`), выставляются в CI из секретов `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` (`.github/workflows/build.yml:91-103`).
- `.env.example` / `.env.template` отсутствуют (`.codebase-scan.txt`: «No .env.example or .env.template found»). `.env*` в `.gitignore`.
- Ограничения деплоя: только Android APK; магазины и iOS-сборка удалены (`README.md:20,77`); подпись — постоянный keystore, иначе обновление «поверх» невозможно (`.github/workflows/build.yml:84-89`); при отсутствии секрета собирается debug-ключ, и такая сборка не обновляется поверх релизной.

### 6) Evidence

- `package.json`
- `package-lock.json`
- `app.json`
- `tsconfig.json`
- `metro.config.js`
- `.npmrc`
- `.github/workflows/build.yml`
- `.github/workflows/security-scan.yml`
- `android/app/build.gradle`
- `android/gradle.properties`
- `scripts/run-tests.mjs`
- `scripts/check-version-parity.mjs`
- `docs/codebase/.codebase-scan.txt`
