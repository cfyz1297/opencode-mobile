# OpenCode Mobile (форк cfyz1297)

Форк [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) с поддержкой **OpenCode API V2** (сервер 2.0.x).

## Установка (Android, APK)

Стабильная ссылка — всегда последний релиз:

- **[Скачать opencode-mobile-v2.apk](https://github.com/cfyz1297/opencode-mobile/releases/latest/download/opencode-mobile-v2.apk)** (~86 МБ)
- Все релизы: [Releases](https://github.com/cfyz1297/opencode-mobile/releases) — на каждый новый билд свой релиз (`0.2.15`, `0.2.18`, …), файл APK во всех называется `opencode-mobile-v2.apk`

> ⚠️ Разовая переустановка: начиная с `0.2.9` APK подписывается постоянным ключом (раньше на каждый билд генерировался новый debug-ключ, поэтому обновление поверх не устанавливалось). Если стоит сборка старее — удалить её **один** раз и поставить текущую, дальше обновления ставятся поверх без удаления.

APK собирается GitHub Actions из `main` этого репозитория и подписывается постоянным ключом из секретов репозитория (без секрета — debug-ключ). Google Play / F-Droid / App Store — не используются: эти workflow отключены. Активны только `Build Android APK` и `Security scan`.

## Подключение к серверу opencode

Нужен сервер **opencode 2.0.x** (V2 API). V2 ставится нативным бинарником — npm-пакет `opencode-ai` остался на линии 1.x и `/api/*` не обслуживает.

1. Поставить и запустить сервер:

   ```bash
   curl -fsSL https://opencode.ai/v2/install | bash
   OPENCODE_SERVER_PASSWORD=вашпароль opencode serve --hostname 0.0.0.0 --port 4096
   ```
2. В приложении: **Add Connection** → адрес сервера (`http://IP:4096`), логин `opencode`, пароль из команды выше.

Формат V2 (проверено на 2.0.27): Basic-аутентификация только в виде `opencode:<пароль>` (Bearer и пустой пользователь = 401), все пути `/api/*`, страничные ответы `{data, cursor}`, SSE `GET /api/event`.

## Что добавил форк

- Адаптер `src/lib/v2-compat.ts`: ответы и события V2 приводятся к V1-форме, поэтому сторы и экраны остались прежними. V1-события (`session.status`, `message.part.updated`) собираются из V2-дельт (`session.text.delta`, `session.reasoning.delta`, `session.tool.*`).
- SDK переключён на `/api/session`, `/api/event`, `/api/info`, `/api/permission/request`, `/api/fs/*`, `/api/project`.
- Смена модели/агента сессии — через `POST /api/session/{id}/model` и `/agent`.

В основу — [upstream README](https://github.com/dzianisv/opencode-mobile#readme) (демо-режим, мультисессии, биометрия, дифф-вьюер, подтверждение вызовов инструментов, вопросы агента).

## Нативная Java-версия

Отдельный клиент на чистом Java без Gradle (`aapt → ecj → d8 → apksigner`), тоже на V2 API: [docs/native-app.md](docs/native-app.md).

## Сборка из исходников

```bash
git clone https://github.com/cfyz1297/opencode-mobile
cd opencode-mobile
npm install
npm run android            # dev-сборка на устройстве/эмуляторе
```

Релизный APK собирает GitHub Actions (`.github/workflows/build.yml`) на каждый push в `main` и на теги `v*`: сначала тесты, typecheck и проверка версий, потом `expo prebuild` + `gradlew assembleRelease`. Артефакт — `app-release`; GitHub-релиз с APK публикуется вручную.

Тесты: `npm test` (356/356). Typecheck: `npm run typecheck`.

## Лицензия и заимствования

MIT — см. [LICENSE](LICENSE). Учитываем upstream [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) и [sst/opencode](https://github.com/sst/opencode).
