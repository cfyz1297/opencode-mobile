# OpenCode Mobile (форк cfyz1297)

Форк [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) с поддержкой **OpenCode API V2** (сервер 2.0.x).

## Установка (Android, APK)

Стабильная ссылка — всегда последний релиз:

- **[Скачать opencode-mobile-v2.apk](https://github.com/cfyz1297/opencode-mobile/releases/latest/download/opencode-mobile-v2.apk)** (~92 МБ)
- Все релизы: [Releases](https://github.com/cfyz1297/opencode-mobile/releases) — на каждый новый билд свой релиз (`v2.1`, `v2.2`, …), файл APK во всех называется `opencode-mobile-v2.apk`

> ⚠️ Разовая переустановка: начиная с `v2.2` APK подписывается постоянным ключом (до этого на каждый билд генерировался новый debug-ключ, поэтому обновление поверх не устанавливалось). Старую версию нужно удалить **один** раз, поставить `v2.2` — и все последующие обновления будут ставиться поверх без удаления.

APK собирается GitHub Actions из `main` этого репозитория (debug-keystore). Google Play / F-Droid — не используются: все публиковавшие workflow отключены, чтобы не присылать письма о падениях.

## Подключение к серверу opencode

1. Запустите сервер:

   ```bash
   npm install -g opencode-ai
   OPENCODE_SERVER_PASSWORD=вашпароль opencode serve --hostname 0.0.0.0 --port 4096
   ```
2. В приложении: **Add Connection** → адрес сервера (`http://IP:4096`), логин `opencode`, пароль из шага 1.

Формат V2 (OpenCode 2.0.x): Basic-аутентификация только в виде `opencode:<пароль>` (Bearer и пустой пользователь = 401), все пути `/api/*`, страничные ответы `{data, cursor}`, SSE `GET /api/event`.

## Что добавил форк

- Адаптер `src/lib/v2-compat.ts`: эндпоинты V1 транслируются в `/api/*` V2, V1-события (`session.status`, `message.part.updated`) синтезируются из V2-дельт.
- SDK переключён на `/api/session`, `/api/event`, `/api/info`, `/api/permission`, `/api/model`.
- Отправка model/agent/variant через switch-эндпоинты.

В основу — [upstream README](https://github.com/dzianisv/opencode-mobile#readme) (демо-режим, мультисессии, биометрия, дифф-вьюер, approved tool calls).

## Сборка из исходников

```bash
git clone https://github.com/cfyz1297/opencode-mobile
cd opencode-mobile
npm install
npm run android            # или релизный APK через GitHub Actions
```

Тесты: `npm test` (358/358). Typecheck: `npm run typecheck`.

## Лицензия и заимствования

MIT — см. [LICENSE](LICENSE). Учитываем updstream [dzianisv/opencode-mobile](https://github.com/dzianisv/opencode-mobile) и [sst/opencode](https://github.com/sst/opencode).
