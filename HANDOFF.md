# OpenCode Mobile — мастер-документ (форк cfyz1297)

Актуально на **2026-10-25**.
- App: **`cc.agentlabs.opencode`** — Expo/React Native Android-клиент к собственному серверу `opencode serve` (V2 API).
- Репозиторий форка: **`cfyz1297/opencode-mobile`**. Апстрим для справки: `dzianisv/opencode-mobile`.
- Пользователь запускает сервер в Termux на телефоне; приложение — клиент к нему.

## Состояние на 2026-10-25

| Что | Значение |
|---|---|
| Версия | **0.2.22**, versionCode **56** (`app.json`, `package.json`, `android/app/build.gradle`, проверка в CI) |
| Ветки | `main` = `master` (релизный коммит — см. `git log -1`) |
| Тег | `v0.2.22` |
| Release | https://github.com/cfyz1297/opencode-mobile/releases/tag/v0.2.22 — `opencode-mobile-v2.apk` + `SHA256SUMS.txt` |
| APK | см. тело релиза: SHA256 указан в описании и в `SHA256SUMS.txt` |
| Подпись | production keystore, сертификат тот же, что у 0.2.20 → установка поверх без удаления |
| Каналы | только `Build Android APK` и `Security scan`. Play / F-Droid / App Store не используются, на тег `v*` не запускаются |
| Тесты | `npm test` — **520 passed, 0 failed**; покрытие **98.61 / 84.97 / 96.06** при пороге 80; `npm run typecheck` чисто |

Что нового в 0.2.22:

- **Диалог обновляется сам.** Если события одного прогона потерялись при живом сокете, приложение через 12 с тишины само дочитывает переписку: ответ появляется, «Работаю…» гаснет, незавершённый ответ показывается частично. Раньше помогал только перезаход в сессию. Реализация: `src/lib/run-watchdog.ts` + сторож в `src/stores/events.ts`, `applyServerMessages` в `src/stores/sessions.ts`. Отчёт: `docs/run-resync-validation.md`.

Что нового в 0.2.21:

1. **Статус подключения не врёт.** «Активно» показывается только после ответа сервера (`src/lib/connection-health.ts` + `app/(tabs)/connections.tsx`). При выключенном Termux — «Сервер недоступен». Проверка при фокусе вкладки, раз в 15 с и при возврате приложения; результат привязан к клиенту.
2. **Экран «Модели»** (`app/models.tsx`) рядом с «Провайдерами»: поиск, группы, переключатели видимости; действует в обоих picker-ах; настройки локальны и разделены по подключению.
3. **Провайдеры**: короткий каталог популярных (OpenCode Zen/Go первыми), подключение API-ключом через сервер. Ключи в APK не хранятся. OAuth **не реализован**.
4. **Безопасность**: пароли серверов пишутся только как `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; форма подключения предупреждает о пароле по `http://`; разрешение `SYSTEM_ALERT_WINDOW` заблокировано и в APK отсутствует.

Подробности: `docs/run-resync-validation.md`, `docs/security-review-0.2.21.md`, `docs/connection-status-validation.md`, `docs/model-visibility-validation.md`, пользовательское описание — `README.md`.

## Что дальше

1. **Ручная проверка на устройстве** (единственный содержательный долг): провайдер → «Модели» → выключить модель → оба окна выбора → перезапуск → смена сервера → включить обратно. Отдельно: туннель, планшетный layout, офлайн-история — функции 0.2.20, вручную не проверялись. И отдельно — новый досбор диалога: отправить сообщение, дождаться ответа, ничего не перезаходя.
2. Известные остатки: 401/403 показывается как «Сервер недоступен»; `global.health()` в SDK считает отсутствующий `healthy` за `true` (совместимость со старыми серверами); `npm audit` — 11 уязвимостей только в сборочной цепочке Metro/PostCSS, в APK не входят; сессия, навсегда оставшаяся «busy» при не-404 ошибке, опрашивается раз в 12 с. Подробно — `docs/security-review-0.2.21.md`, `docs/run-resync-validation.md`.

## Как собрать и выпустить

Тестовый APK без релиза: запушить коммиты → `Build Android APK` (workflow_dispatch, `reuse_apk_run_id` пустой) → артефакт `app-release`. Release и тег не создавать.

Релиз:
1. Поднять версию в четырёх местах: `package.json`, `app.json` (`expo.version` + `expo.android.versionCode`), `android/app/build.gradle` (`versionName` + `versionCode`), и проверки `versionCode='NN'` / `versionName='x.y.z'` в `.github/workflows/build.yml`.
2. `npm run check:versions` — версии в трёх файлах должны совпасть.
3. Слить в `main`, поставить тег `vX.Y.Z`, дождаться зелёного CI на теге.
4. Опубликовать GitHub Release вручную с текстом изменений в описании и приложить `app-release.apk` под именем `opencode-mobile-v2.apk` (+ `SHA256SUMS.txt`): workflow Release не создаёт, а `releases/latest/download/opencode-mobile-v2.apk` используется встроенной проверкой обновлений.
5. Обновить `README.md` (раздел «Новое в …») и этот файл.

## Правила окружения этого форка

- Git в `E:/ai/opencode-mobile` требует разового `git -c safe.directory=E:/ai/opencode-mobile ...`.
- `gh` CLI не авторизован: работать через `git credential fill` → токен → REST API (dispatch, artifacts, merge, releases, uploads.github.com).
- UTF-8 JSON для REST собирать в `node` и отправлять `Invoke-RestMethod -InFile`; PowerShell `ConvertTo-Json` ломает кириллицу.
- Перед подтверждением «готово» прогонять `npm run check:versions`, `npm run typecheck`, `npm run test:coverage`.
- `dist/` — локальные APK прошлых сборок, untracked; в Git не добавлять.

---
