# OpenCode Mobile — мастер-документ (форк cfyz1297)

Актуально на **2026-10-25**.

- App: **`cc.agentlabs.opencode`** — Expo/React Native Android-клиент к собственному серверу `opencode serve` (V2 API).
- Репозиторий форка: **`cfyz1297/opencode-mobile`**. Апстрим для справки: `dzianisv/opencode-mobile`.
- Пользователь запускает сервер в Termux на телефоне; приложение — клиент к нему.

## Состояние на 2026-10-25

| Что | Значение |
|---|---|
| Версия | **0.2.21**, versionCode **55** (`app.json`, `package.json`, `android/app/build.gradle`, проверка в CI) |
| Ветки | `main` = `master` = `origin/main` = `origin/master` = `4da83de` |
| Тег | `v0.2.21` |
| Release | https://github.com/cfyz1297/opencode-mobile/releases/tag/v0.2.21 — `opencode-mobile-v2.apk` + `SHA256SUMS.txt` |
| APK | 86 385 477 байт, SHA256 `ff4c156ccc36f4ee4279e48a465e8f599bae956e9a64eb5d78fd0aaedb8968df` |
| Подпись | production keystore, сертификат совпадает с 0.2.20 → установка поверх без удаления |
| Каналы | только `Build Android APK` и `Security scan`. Play / F-Droid / App Store не используются, на тег `v*` не запускаются |
| Тесты | `npm test` — **506 passed, 0 failed**; покрытие **98.59 / 84.87 / 96.02** при пороге 80; `npm run typecheck` чисто |
| CI на релизе | run **40193595672** (`test`, `build`, `Android roadmap CUA smoke` — success) |

Что нового в 0.2.21:

1. **Статус подключения не врёт.** «Активно» показывается только после ответа сервера (`src/lib/connection-health.ts` + `app/(tabs)/connections.tsx`). При выключенном Termux — «Сервер недоступен». Проверка при фокусе вкладки, раз в 15 с и при возврате приложения; результат привязан к клиенту.
2. **Экран «Модели»** (`app/models.tsx`) рядом с «Провайдерами»: поиск, группы, переключатели видимости; действует в обоих picker-ах; настройки локальны и разделены по подключению.
3. **Провайдеры**: короткий каталог популярных (OpenCode Zen/Go первыми), подключение API-ключом через сервер. Ключи в APK не хранятся. OAuth **не реализован**.
4. **Безопасность**: пароли серверов пишутся только как `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; форма подключения предупреждает о пароле по `http://`; разрешение `SYSTEM_ALERT_WINDOW` заблокировано и в APK отсутствует.

Подробности: `docs/security-review-0.2.21.md`, `docs/connection-status-validation.md`, `docs/model-visibility-validation.md`, пользовательское описание — `README.md`.

## Что дальше

1. **Ручная проверка на устройстве** (единственный содержательный долг): провайдер → «Модели» → выключить модель → оба окна выбора → перезапуск → смена сервера → включить обратно. Отдельно: туннель, планшетный layout, офлайн-история — функции 0.2.20, вручную не проверялись.
2. Известные остатки: 401/403 показывается как «Сервер недоступен»; `global.health()` в SDK считает отсутствующий `healthy` за `true` (совместимость со старыми серверами); `npm audit` — 11 уязвимостей только в сборочной цепочке Metro/PostCSS, в APK не входят. Подробно — `docs/security-review-0.2.21.md`.

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
