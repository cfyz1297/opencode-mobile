# OpenCode Mobile (форк cfyz1297)

Форк [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) с поддержкой **OpenCode API V2** (сервер 2.0.x).

Версия **0.2.20 (54)** продолжает пользовательскую линию 0.2.19.

> **Важно:** новый функционал 0.2.20 (мастер туннелей, планшетный интерфейс, офлайн-история) **ещё не проверялся пользователем** на реальном устройстве и реальном сервере. Есть автотесты и Android CUA smoke на эмуляторе; это не замена ручной проверке. Перед повседневным использованием пройдите сценарии сами и сообщите о сбоях.

### Новое в 0.2.20

- **Мастер Cloudflare / ngrok**: Add Connection → Настройка Cloudflare / ngrok. Выберите сервис и систему компьютера, выполните две команды на компьютере и вставьте HTTPS-адрес туннеля и пароль сервера. Приложение проверяет соединение перед сохранением. Сервер привязывается к loopback; туннель требует пароль. Установку cloudflared/ngrok и вход в ngrok выполняет владелец компьютера.
- **Планшеты**: боковая навигация от 768 dp, список сессий рядом с чатом от 1000 dp, ограничение ширины переписки и поддержка изменения ориентации/размера окна.
- **История офлайн**: Settings → История сессий офлайн → включить сохранение, затем открыть сессию онлайн. Локальные копии доступны даже после перезапуска без сети. До 20 сессий на подключение, до 40 последних текстовых сообщений на сессию; длинные сообщения и общий объём ограничены. Хранилище защищено Android Keystore / iOS Keychain; инструменты, вложения и рассуждения исключены. Очистка удаляет копии всех подключений и выключает дальнейшее сохранение. Копии доступны только для чтения и не отправляются модели.

Подключение OpenCode Cloud не входит в этот релиз по просьбе владельца. iOS-пакет не публикуется; проверка планшетного интерфейса в CI выполняется на Android-эмуляторе, не на физическом iPad.

Для Cloudflare нужен **именованный туннель**, аккаунт и домен: в панели Cloudflare создайте Tunnel и Published application route с Service URL `http://127.0.0.1:4096`, затем запустите команду с токеном на компьютере. Токен Cloudflare в приложение не вводится. Быстрые адреса `trycloudflare.com` отклоняются мастером: [они не поддерживают SSE](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/#limitations), необходимый для потоковых ответов. Альтернатива без своего домена — ngrok.

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

Тесты (Node.js 24+): `npm test`. Общее покрытие с порогом 80%: `npm run test:coverage`. Исправления SDK и HTTP-интеграционные тесты 0.2.19 сохранены; исходный отчёт: [TEST_REPORT.md](TEST_REPORT.md). Typecheck: `npm run typecheck`. Проверка новой логики с покрытием: `node --test --experimental-test-coverage src/lib/offline-history.test.ts src/lib/tunnel.test.ts src/lib/adaptive-layout.test.ts`.

Сборка включает Android CUA smoke: релизный APK, команды мастера, отклонение HTTP до сетевого обращения, переходы между сессиями в двух панелях, смена размера окна, холодный перезапуск без сервера, чтение и очистка истории. Артефакт `roadmap-smoke-evidence` содержит снимки экрана и результат. Проверка и известные ограничения: [RELEASE_REVIEW_0.2.20.md](RELEASE_REVIEW_0.2.20.md).

## Лицензия и заимствования

MIT — см. [LICENSE](LICENSE). Учитываем upstream [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) и [sst/opencode](https://github.com/sst/opencode).
