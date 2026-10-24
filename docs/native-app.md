# OpenCode Mobile

Нативное Android-приложение на чистом Java (без Gradle и Android Studio),
клиент к **OpenCode V2 HTTP API** (`/api/*`, сервер 2.0.x). Собирается
прямо в Termux.

- `minSdkVersion 24`, `targetSdkVersion 30`, версия 1.0
- один экран, 6 вкладок: Chat · Sessions · Models · Agents · Files · Settings
- APK ~33 КБ, всё в одном `classes.dex`, сторонних библиотек нет

## Возможности

- **Chat** — переписка с агентом: отправка промпта
  (`POST /api/session/{id}/prompt`), остановка (`interrupt`), обновление по SSE
  (`GET /api/event`, авто-переподключение через 3 с). Ответы рендерятся как
  markdown (заголовки, **жирный**, *курсив*, `код`, ```блоки```, списки,
  ссылки), текст можно выделять. У сообщений видно агента, модель и время;
  вызовы инструментов показываются строками `⚙ tool — title`.
- **Permissions** — оранжевый баннер над чатом для запросов разрешений
  (file edit, shell): `Once` / `Always` / `Reject`
  (`GET /api/permission/request`, `POST /api/session/{id}/permission/{pid}/reply`).
  Список обновляется при открытии Chat и при событиях `permission.*`.
- **Sessions** — список (`limit 50`, новые сверху) с моделью, агентом и
  стоимостью в $. Тап открывает сессию (она запоминается и восстанавливается
  после перезапуска), долгий тап — меню **Open / Fork / Delete**.
  Кнопка `＋ New session`.
- **Models** — все модели всех подключённых провайдеров
  (`GET /api/model`); тап переключает модель открытой сессии
  (`POST /api/session/{id}/model`).
- **Agents** — агенты без флага скрытия (`GET /api/agent`), тап переключает
  агента сессии (`POST /api/session/{id}/agent`).
- **Files** — браузер файлов от корня Location-а сервера: каталоги
  открываются по тапу (`GET /api/fs/list?path=`), файл показывается в диалоге
  моноширинным текстом (`GET /api/fs/read/{path}`).
- **Settings** — URL, пользователь, пароль (хранятся в `SharedPreferences`
  «ocm»); **Save & connect** сохраняет, запускает поток событий и проверяет
  соединение через `GET /api/info` (в тосте — версия сервера).

## Подключение

1. Узнай адрес сервиса:
   ```
   opencode service status
   ```
2. Возьми пароль:
   ```
   cat ~/.config/opencode/service.json
   ```
3. Вкладка **Settings** → URL (по умолчанию `http://127.0.0.1:49374`),
   пользователь `opencode`, пароль из шага 2 → **Save & connect**.

Аутентификация — только HTTP Basic `opencode:<пароль>`. Bearer-токен или пустой
логин дают 401. Пути — только `/api/*` (старые V1-пути вроде `/session`,
`/global/health` сервер не обслуживает). Списки приходят обёрнутыми в
`{data: [...], cursor?}`; у сообщений `limit` должен быть ≤ 200.

## Сборка

Зависимости (Termux):

```
pkg install aapt d8 apksigner ecj
```

(`ecj` тянет openjdk, оттуда же берётся `keytool` для подписи.)

```
./build.sh
```

Скрипт: `aapt → ecj → d8 → aapt add → apksigner`.

- При первом запуске скачивается полный framework jar
  `platform-30_r03.zip` → `lib/android.jar` (~23 МБ): в нём есть
  `resources.arsc`, который нужен `aapt`. Заглушка `android.jar` из пакета
  `d8` не подходит — не заменяй.
- Ключ `build/ocm.keystore` создаётся один раз и переиспользуется, поэтому
  обновления ставятся поверх старой версии.
- Результат — `OpenCodeMobile.apk` в корне проекта.

## Установка

```
termux-open OpenCodeApp/OpenCodeMobile.apk
```

Разрешить Termux установку из «неизвестных источников» (или скопировать APK во
внутреннее хранилище после `termux-setup-storage`).

## Траблшутинг

- **Connection refused** — сервис не запущен: `opencode service status`
  (команда поднимает сервис), сверь порт в Settings.
- **Authentication required / 401** — пароль не из текущего `service.json`
  (`opencode service status` пересоздаёт файл), либо указан другой пользователь;
  нужен именно `opencode`.
- **Пустой Chat / не приходят обновления** — сервер должен отдавать SSE на
  `GET /api/event`; приложение переподключается каждые 3 секунды, но при
  протухшем пароле поток молча не поднимется — пересохрани Settings.
- **`localhost` недоступен из приложения** — запусти
  `opencode serve --hostname 0.0.0.0 --port 49374` и укажи LAN-IP.

## Файлы

- `AndroidManifest.xml`, `res/drawable-nodpi/icon.png`
- `src/ai/opencode/mobile/Json.java` — минимальный JSON-парсер/сериализатор
  (объекты → `LinkedHashMap`, массивы → `List`)
- `src/ai/opencode/mobile/Api.java` — HTTP-обёртка: Basic-auth, GET/POST/DELETE,
  разбор `{data}`-обёрток, поток SSE, кодирование путей (плюс неиспользуемый
  `patch`)
- `src/ai/opencode/mobile/Md.java` — markdown → `Spanned` через `Html.fromHtml`
- `src/ai/opencode/mobile/MainActivity.java` — весь UI (6 вкладок), SSE-цикл,
  запросы разрешений
- `build.sh` — aapt → ecj → d8 → apksigner
