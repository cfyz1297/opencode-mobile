# Проверка безопасности 0.3.2

Дата: 2026-11-06. Релиз 0.3.2 (67). Предыдущие отчёты: `docs/security-review-server-api.md`, `docs/security-review-0.2.21.md`.

Проверялось: изменения аудита `ponytail-audit-opencode-mobile.md` (сохранение версии API, определение V1/V2, локаль речи, локализация уведомлений, удаление waitlist/Chatwoot/React Query, общий HTTP-слой, CI), поверхность атаки релизного APK, хранение секретов, глубокие ссылки, диагностика, зависимости. Метод: чтение диффа и кода, `npm audit`, статический скан секретов по отслеживаемым файлам, инварианты в тестах, разбор `AndroidManifest.xml` и backup-правил, прогон `check:versions`, `typecheck`, `test`, `test:coverage`.

## Исправлено

| # | Severity | Проблема | Исправление |
|---|----------|----------|-------------|
| 1 | LOW | Диагностика логировала и включала в отчёт URL подключения как есть. URL с `user:pass@host` или `?token=` (Advanced-режим принимает произвольную строку) попадал в буфер логов и в текст, который копируется/отправляется через share sheet. | `src/lib/diagnostics.ts`: старт пробы логируется через `scrubUrl()`, весь `formatReport()` проходит через `scrubString()` — basic-auth и `token/api_key/password` в query заменяются на `<redacted>`, хост остаётся читаемым для отладки. Инвариант — `security-baseline.test.ts`. |
| 2 | LOW | `id` сессии из deep link `opencode://session/...` и из payload уведомления подставлялся в путь API без проверки. `..` или `/` в id позволяли сформировать запрос к другому эндпоинту того же сервера с сохранёнными Basic-кредами (например, `GET /api/config`). | `src/lib/session-id.ts` (`isSafeSessionId`, алфавит `A-Za-z0-9_-`, до 200 символов) + проверка на границе экрана в `app/session/[id].tsx`. Тест `session-id.test.ts`. |
| 3 | MED (корректность) | `401/403` на `/api/info` записывался как доказательство V2. На V1-сервере за паролем или reverse-proxy так же отвечает auth-middleware, поэтому подключение навсегда получало неверный транспорт и после верного пароля ходило по несуществующим `/api/*`. | `detectServerApi` возвращает `{ api: undefined }` при неоднозначном ответе; версия не сохраняется (`resolved: false`) и перепроверяется после авторизации. Тесты `api-detect.test.ts`, `connection-bootstrap.test.ts`. |
| 4 | Hardening | Проверялся конфиг `blockedPermissions`, но не собранный APK: stale prebuild-манифест в репозитории всё ещё содержит `SYSTEM_ALERT_WINDOW`. | CI после `assembleRelease` проверяет `aapt dump permissions`: `SYSTEM_ALERT_WINDOW` в APK быть не должно; `application-debuggable` в badging тоже запрещён (`.github/workflows/build.yml`). |
| 5 | Privacy | Форма waitlist отправляла e-mail на сторонний `opencode.agentlabs.cc`, а мёртвый клиент Chatwoot держал код доставки диагностики в поддержку. Обе поверхности не использовались, но оставались в бинарнике и в фоновой очереди. | Удалены `waitlist*.ts`, `chatwoot.ts`, `sendReportToSupport`, `CHATWOOT_SOURCE_KEY`, env-переменные и ключ из allowlist (`persisted-keys.test.ts`). Диагностика уходит только через системный share sheet по нажатию пользователя. |

## Проверено, изменений не потребовалось

- **Секреты в репозитории.** Статический скан всех отслеживаемых файлов (private key, GitHub/AWS/Google/OpenAI/Slack/Stripe-токены) чист. Единственное совпадение — заведомо фиктивный `AIzaSyDummyGoogleKeyValue…` в `custom-provider.test.ts`. В рабочем дереве нет `.env`, keystore, `google-services.json`, `sentry.properties`, APK/AAB. В истории остаётся только upstream-артефакт `fdroid/repo/app-release.apk` — публичная сборка апстрима, ключей подписи форка в нём нет; полный скан истории выполняет gitleaks в CI (`security-scan.yml`, `fetch-depth: 0`).
- **Пароли серверов.** Пишутся только с `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; инвариант в `security-baseline.test.ts`. Пустой пароль не создаёт `Authorization` (`buildAuth`).
- **Резервное копирование Android.** `allowBackup=true`, но `expo-secure-store` подключает `@xml/secure_store_backup_rules` и `@xml/secure_store_data_extraction_rules`: в облако и при переносе устройства попадает только домен `sharedpref`, а `SecureStore` из него исключён. AsyncStorage (видимость/любимые модели, отметка обновлений) не секрет и в правила не включён.
- **Разрешения APK.** Новых разрешений нет: `INTERNET`, `RECORD_AUDIO` (голосовой ввод), `USE_BIOMETRIC`/`USE_FINGERPRINT` (AppGate), `VIBRATE`, legacy storage для image picker. `SYSTEM_ALERT_WINDOW` блокируется в `app.json` и теперь проверяется на собранном APK (п.4).
- **Телеметрия.** Зависимостей и вызовов Sentry, PostHog, Firebase, analytics нет. Наружу уходят только: сервер пользователя, `api.github.com` (проверка обновлений, один GET в сутки), `gstatic.com/generate_204` (проверка интернета) и явный share sheet.
- **Серверный текст в UI.** Уведомления о permission/question по-прежнему несут фиксированные ключи переводов без интерполяции (тест проверяет все локали), детали остаются в приложении. Markdown рендерится `react-native-marked` в `Text`/`View`; WebView, `eval`, `new Function` и `dangerouslySetInnerHTML` в проекте отсутствуют.
- **Глубокие ссылки.** Схема `opencode://` не добавляет подключения: форма `connection/add` не читает URL из параметров. `providers/connect` кодирует provider id (`encodeURIComponent`) и предпочитает имя из каталога, а не из query. Session id теперь валидируется (п.2).
- **Ключи провайдеров.** Уходят только на сервер пользователя (`/api/integration/.../connect/key`, `/auth/{id}`) и не сохраняются на телефоне; в логи не пишутся.
- **Офлайн-история.** Opt-in, только текст, без tool output/вложений/рассуждений, чанками в SecureStore с `THIS_DEVICE_ONLY`; покрыто тестами.
- **Fail-closed.** Health успешен только при JSON или явном `healthy: true`; 401/403 останавливает цикл реконнекта SSE; не-2xx и не-JSON дают `ApiError`.
- **Обновления и подпись.** Проверка обновлений идёт по HTTPS к GitHub API, установку выполняет Android (проверка подписи ОС). CI сверяет сертификат собранного APK с закреплённым SHA-256; keystore в репозиторий не попадает.

## `npm audit`

`npm audit` на 2026-11-06: **21 запись — 1 low, 13 moderate, 7 high, 0 critical**. Все — транзитивные зависимости цепочки сборки Expo/Metro (`@expo/cli`, `glob`, `minimatch`, `postcss`, `node-forge`, `image-size`, `brace-expansion`) и `expo-router → query-string → decode-uri-component`. В рантайме приложения `query-string` используется только через `stringify` (построение пути из состояния навигации); уязвимый `parse`/`decode-uri-component` не вызывается. `npm audit fix --force` предлагает откат Expo на 52 и ломает проект, поэтому изменения не применялись — риск ограничен сборочным раннером, а не устройством. Это осознанно принятый остаток, как и в 0.3.0.

## Известные остатки (приняты)

- **Пароль по `http://`** — предупреждение, не запрет: серверы в LAN и Termux часто без TLS.
- **`usesCleartextTraffic=true`** — следствие того же сценария; ограничить списком хостов нельзя.
- **Отчёт диагностики содержит хост и порт сервера** — пользователь копирует/отправляет его сам; креды из URL теперь вычищаются (п.1).
- **Параметр `directory` в deep link** может переключить клиент на другую папку того же сервера. Это не граница привилегий (один пользователь, один сервер), поэтому оставлено.
- **Нет certificate pinning** — самодельные серверы меняют сертификаты; проверка отпечатка сломала бы подключение.
- **Сборка зависимостей** — компрометация CI-раннера или npm-пакета не покрывается клиентскими мерами; частично закрыто gitleaks и пиннингом lockfile.

## Не проверялось

Нативная сборка Gradle и установка APK на устройство/эмулятор (локального Android SDK нет — это делает CI), живой `opencode serve` 1.18.x, iOS-сборка, gitleaks локально (запускается в CI на push/PR). CI-проверка APK на `SYSTEM_ALERT_WINDOW` и `debuggable` добавлена в этом релизе и будет подтверждена первым зелёным прогоном.
