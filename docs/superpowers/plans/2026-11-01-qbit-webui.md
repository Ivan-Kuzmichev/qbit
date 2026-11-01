# qBit WebUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Статический альтернативный WebUI для qBittorrent 5.x (десктоп + телефон) по ТЗ и макетам, с релизами через GitHub Actions.

**Architecture:** React SPA без бэкенда: тонкий клиент `/api/v2`, Zustand-стор, который сливает инкрементальный `sync/maindata`, чистые функции для форматов, статусов и разбора данных. Десктоп и мобильная версия — разные деревья экранов поверх общих стора, API и UI-примитивов; переключаются по `matchMedia` на 768px.

**Tech Stack:** Vite, React 18, TypeScript strict, Zustand, CSS Modules + `tokens.css`, lucide-react, @fontsource, flag-icons, TanStack Virtual; тесты — Vitest + Testing Library, e2e — Playwright против настоящего qBittorrent в Docker.

**Spec:** `docs/spec.md` (экспорт ТЗ, ревизия 18). Макеты: `design/*.dc.html` (исходники холста; стили и значения читать прямо из разметки).

## Global Constraints

- qBittorrent 5.x, WebAPI ≥ 2.11, без совместимости с 4.x: ниже — экран «Нужен qBittorrent 5.0 или новее» с текущей версией.
- Никаких внешних запросов в рантайме: шрифты, флаги, иконки только из бандла. Ни аналитики, ни телеметрии.
- Бандл без шрифтов и флагов ≤ 300 КБ gzip; флаги подгружаются по требованию.
- Результат сборки: `qbit/public/` (`index.html` и ассеты); корень альтернативного WebUI — `qbit`.
- Только hash-роутинг (`#/settings`), `base: './'`.
- Значения цветов, шрифтов, размеров, радиусов — только из раздела «Дизайн-система» ТЗ, через токены в `src/styles/tokens.css`.
- Все строки интерфейса — в `src/i18n/ru.ts`. Язык только русский.
- Единицы: основание 1024, подписи Б, КБ, МБ, ГБ, ТБ; до 10 — два знака, до 100 — один, дальше без дроби; разделитель — точка (как в макетах).
- Десктоп от 768px; ниже — мобильная раскладка: тап-зоны ≥ 44px, поля ввода ≥ 16px.
- Браузеры: последние две версии Chrome, Firefox, Safari; iOS 16+.
- 1000+ торрентов без подтормаживаний.
- Настоящие `<button>`, `<input>`, `<label>`; `aria-label` у иконочных кнопок; контраст ≥ 4.5:1; статус — иконка и текст, не только цвет.

## Решения и расхождения

Когда ТЗ и макет расходятся, побеждает ТЗ. Решения ниже приняты при планировании:

| Вопрос | Решение |
|---|---|
| Tailwind или CSS Modules | CSS Modules: значения нестандартные (12.5px, 236px), утилиты не дают выигрыша |
| Вид настроек | Разделы по ТЗ («Внешний вид» вместо «Дополнительно» в макете) |
| «Открыть папку» в макетах | «Переместить», иконка та же (ТЗ) |
| Шрифт полей в мобильных макетах (13–14px) | 16px (ТЗ, иначе зум на iOS) |
| Версия на экране входа | `app/version` без сессии отвечает 403, поэтому до входа версия qBittorrent неизвестна. Показываем `qBit vX.Y.Z`; версии qBittorrent и WebAPI — из `localStorage`, если уже входили |
| Фильтры | Загрузка = «Скачивается», Раздача = «Раздаётся», Завершено = «Готово», Пауза = только «Пауза», «В очереди» и «Ошибка» — свои пункты. Проверка и перемещение — только в «Все» |
| 1000+ строк и карточка деталей | Экран на высоту окна: таблица `flex: 1` со своей прокруткой, карточка деталей `max-height: 45vh` со своей прокруткой |
| Цвет категории | Цвета в API нет: хеш имени → палитра из 6 цветов |
| Папка статики | Vite `publicDir: 'static'`, чтобы не путать с выходной `qbit/public/` |
| Service worker | Нет: ТЗ требует только manifest, а кеш мешает обновлению WebUI |

**Сверка с вики WebAPI 5.0.** Вики устарела и местами противоречит ТЗ; проверяем на живом qBittorrent в Docker (Task 8):
- `torrents/add`: вики описывает `paused`, ТЗ — `stopped`. Отправляем оба поля с одним значением.
- `alt_dl_limit`, `alt_up_limit`: вики пишет КиБ/с, ТЗ — байт/с. Считаем байтами; e2e из Task 12 проверяет это по `server_state.dl_rate_limit`.
- `auth/login`: вики гарантирует только 200 и 403. Успех = 2xx и тело не `Fails.`; 401 трактуем как неверный пароль.

## Review Focus

1. **Открытие по HTTP с адреса не localhost** (`http://nas.local:8080`, обычный случай): `crypto.subtle` и `navigator.clipboard` там `undefined`. Infohash и копирование должны работать. Тесты — Task 9 и Task 11.
2. **Magnet без метаданных:** размер 0, `pieceStates` пуст, файлов нет, имя может быть хешем. Строка и детали не падают и не показывают `NaN`. Тесты — Task 2 и Task 13.
3. **Запятая в числах:** русская раскладка и цифровая клавиатура iOS дают `1,5`. Поля понимают `1,5` и `1.5`, пусто и `∞` = без лимита, мусор и минус не отправляются. Тесты — Task 2 и Task 12.
4. **Перезапуск qBittorrent и обрыв сети:** опросы не накладываются, `full_update` заменяет всё, сетевая ошибка даёт плашку, а не экран входа, 403 даёт вход. Тесты — Task 4.
5. **Выбранный торрент удалён извне:** выбор очищается, детали закрываются, опрос останавливается, тосты не идут потоком. Тесты — Task 4 и Task 13.

---

## Этап 1. Каркас

### Task 1: Проект, токены, сборка, CI

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `.gitignore`, `.env.example`, `src/main.tsx`, `src/styles/tokens.css`, `src/styles/base.css`, `src/i18n/ru.ts`, `src/env.d.ts`, `scripts/check-bundle.mjs`, `.github/workflows/ci.yml`
- Test: `src/styles/tokens.test.ts`

**Interfaces:**
- Produces: `npm run dev|build|test|typecheck|lint|check:bundle`; глобальная константа `__APP_VERSION__: string`; `t` из `src/i18n/ru.ts` — объект строк.

- [ ] **Step 1:** `git init`, ветка `main`. Уже лежат `docs/spec.md`, `design/`; `.gitignore` исключает `node_modules`, `qbit/`, `.env`, `test-results/`.
- [ ] **Step 2: Failing test** — `tokens.test.ts`: читает `tokens.css`, проверяет каждый токен таблицы ТЗ (`--bg: #09090B` … `--danger-bg: #DC2626`, всего 18).
- [ ] **Step 3:** Run `npx vitest run src/styles` — FAIL, файла нет.
- [ ] **Step 4:** Написать токены и `base.css`: `html { -webkit-text-size-adjust: 100%; text-size-adjust: 100% }`, фон, Inter 12.5px, кольцо фокуса 3px акцентом с прозрачностью 20% (`color-mix`). Шрифты: `@fontsource/inter/{latin,cyrillic}-{400,500,600}.css`, `@fontsource/jetbrains-mono/{latin,cyrillic}-{400,500}.css`.
- [ ] **Step 5:** `vite.config.ts`: `base: './'`, `publicDir: 'static'`, `build.outDir: 'qbit/public'`, `build.assetsInlineLimit: 0` (иначе мелкие флаги попадут в JS), `define.__APP_VERSION__` из `process.env.APP_VERSION ?? pkg.version`. Прокси `/api` на `QBIT_URL`: `changeOrigin: true`, в `proxyReq` заменить `Origin` и `Referer` на адрес qBittorrent.
- [ ] **Step 6:** `check-bundle.mjs`: суммирует gzip всех `.js`/`.css` в `qbit/public`, падает при > 300 КБ.
- [ ] **Step 7:** `ci.yml`: на push и PR — `npm ci`, typecheck, lint, test, build, check:bundle.
- [ ] **Step 8:** Run `npm run typecheck && npm run lint && npm test && npm run build && npm run check:bundle` — всё зелёное; в `qbit/public/assets` есть `*cyrillic*.woff2`.
- [ ] **Step 9:** Commit `chore: scaffold project with tokens, build and CI`.

### Task 2: Форматы и сведение статусов

**Files:**
- Create: `src/lib/format.ts`, `src/lib/parseNumber.ts`, `src/features/torrents/status.ts`, `src/api/types.ts`
- Test: `src/lib/format.test.ts`, `src/lib/parseNumber.test.ts`, `src/features/torrents/status.test.ts`

**Interfaces:**
- Produces: `formatBytes(n: number): string`, `formatSpeed(n: number): string`, `formatEta(sec: number): string`, `plural(n: number, forms: [string, string, string]): string`, `parseLimitMb(input: string): number | null` (байт/с; 0 = без лимита; `null` = невалидно).
- Produces: `type UiKind = 'downloading'|'seeding'|'done'|'paused'|'queued'|'checking'|'moving'|'error'`; `type RowAction = 'stop'|'start'|'forceStart'|'recheck'|null`; `uiStatus(t: Torrent): { kind: UiKind; action: RowAction; sub: string }`.
- Produces: `src/api/types.ts`: `Torrent`, `ServerState`, `MainData`, `TorrentFile`, `Tracker`, `Peer`, `Properties`, `Preferences`.

- [ ] **Step 1: Failing tests:**

```ts
expect(formatBytes(833)).toBe('833 Б');
expect(formatBytes(1024)).toBe('1.00 КБ');
expect(formatBytes(2.6 * 1024 ** 3)).toBe('2.60 ГБ');
expect(formatBytes(11.8 * 1024 ** 3)).toBe('11.8 ГБ');
expect(formatBytes(1024 ** 2 - 1)).toBe('1.00 МБ'); // округление не даёт «1024 КБ»
expect(formatSpeed(0)).toBe('0 Б/с');
expect(formatSpeed(310 * 1024)).toBe('310 КБ/с');
expect(formatEta(8 * 60)).toBe('8 мин');
expect(formatEta(8640000)).toBe('∞');
expect(plural(31, P)).toBe('31 пир'); // P — формы «пир/пира/пиров»; также 54 пира, 12 пиров, 11 пиров
expect(parseLimitMb('1,5')).toBe(1572864);
expect(parseLimitMb('1.5')).toBe(1572864);
expect(parseLimitMb('')).toBe(0);
expect(parseLimitMb('∞')).toBe(0);
expect(parseLimitMb('-1')).toBeNull();
expect(parseLimitMb('abc')).toBeNull();
```

`status.test.ts` — таблично все строки таблицы состояний ТЗ: `downloading, forcedDL, metaDL` → downloading/stop, sub `«N пиров · осталось X»`; `stalledDL` → sub «Ищет пиров»; `uploading, forcedUP, stalledUP` → seeding/stop; `stoppedUP` → done/start, sub = размер; `stoppedDL` → paused/start, sub «X из Y»; `queuedDL, queuedUP` → queued/forceStart; `checkingDL, checkingUP, checkingResumeData` → checking/null; `moving` → moving/null; `error, missingFiles` → error/recheck. Дополнительно: `forcedMetaDL` → downloading; `unknown` и незнакомая строка → не падает, `paused` при progress < 1 и `done` при progress = 1; размер 0 и `eta` 8640000 дают строку без `NaN`.

- [ ] **Step 2:** Run `npx vitest run src/lib src/features/torrents/status` — FAIL.
- [ ] **Step 3:** Реализовать. Типы `types.ts` — по вики WebAPI 5.0, только используемые поля.
- [ ] **Step 4:** Тесты PASS.
- [ ] **Step 5:** Commit `feat: add formatting and torrent status mapping`.

### Task 3: API-клиент, вход, версия

**Files:**
- Create: `src/api/client.ts`, `src/api/version.ts`
- Test: `src/api/client.test.ts`, `src/api/version.test.ts`

**Interfaces:**
- Produces: `class ApiError extends Error { status: number }`, `class NetworkError extends Error`.
- Produces: `api.get<T>(path, params?)`, `api.post<T>(path, form: Record<string, string|number|boolean>|FormData)`; ответ разбирается как JSON по `Content-Type`, иначе текст. 403 вызывает `setOnForbidden(cb)` и бросает `ApiError`.
- Produces: `login(username, password): Promise<'ok'|'bad'|'banned'>`, `logout()`, `getAppVersion()`, `getApiVersion()`, `isApiSupported(v: string): boolean`.
- Именованные обёртки всех эндпоинтов таблицы ТЗ — там же, `src/api/client.ts`, добавляются задачами, которым нужны.

- [ ] **Step 1: Failing tests** с подменой `fetch`: `login` — 200 `Ok.` → `ok`; 204 с пустым телом → `ok`; 200 `Fails.` → `bad`; 401 → `bad`; 403 → `banned` и `onForbidden` НЕ вызван. Тело login — `application/x-www-form-urlencoded`. `fetch` reject → `NetworkError`. 403 на `get` вызывает `onForbidden`. Массив хешей уходит как `a|b`.

```ts
expect(isApiSupported('2.9.3')).toBe(false); // сравнение чисел, не строк
expect(isApiSupported('2.11.0')).toBe(true);
expect(isApiSupported('2.11.2')).toBe(true);
expect(isApiSupported('3.0.0')).toBe(true);
```

- [ ] **Step 2:** Run — FAIL. **Step 3:** Реализовать. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add WebAPI client, login and version check`.

### Task 4: Стор и опрос

**Files:**
- Create: `src/store/mergeMainData.ts`, `src/store/torrents.ts`, `src/store/ui.ts`, `src/lib/poller.ts`
- Test: `src/store/mergeMainData.test.ts`, `src/store/torrents.test.ts`, `src/lib/poller.test.ts`

**Interfaces:**
- Consumes: `api`, типы из Task 2–3.
- Produces: `mergeMainData(prev: SyncState, resp: MainData): SyncState`; `SyncState = { rid, torrents: Record<hash, Torrent>, categories, tags, server: ServerState }`.
- Produces: `createPoller(fn: () => Promise<void>, intervalMs: number): { start(); stop() }`.
- Produces: `useTorrents` (Zustand): `SyncState` + `speedHistory: {dl: number, up: number}[]`, `connection: 'ok'|'lost'`, `selected: Set<string>`, `anchor`, `select(hash, mode: 'single'|'toggle'|'range', order: string[])`, `clearSelection()`, `startSync()`, `stopSync()`, `refresh()`.
- Produces: `useUi`: `accent`, `setAccent(c)` (localStorage с try/catch, пишет `--accent`), `filter`, `search`, `sort`.

- [ ] **Step 1: Failing tests** `mergeMainData`: частичное обновление меняет только пришедшие поля, у незатронутых торрентов та же ссылка (`toBe`); `torrents_removed`, `categories_removed`, `tags_removed` удаляют; `server_state` сливается по полям; `full_update: true` заменяет всё, включая исчезнувшие торренты.
- [ ] **Step 2: Failing tests** `poller` на фейковых таймерах: следующий вызов только после завершения предыдущего (медленный запрос не накладывается); при `document.hidden` интервал 10 с; `stop()` отменяет таймер; reject не останавливает опрос.
- [ ] **Step 3: Failing tests** стор: `NetworkError` → `connection: 'lost'`, `rid` не сбрасывается; следующий успех → `'ok'`; история скоростей не длиннее 60 точек; выбранный торрент из `torrents_removed` исчезает из `selected`; `range` выбирает диапазон по переданному порядку.
- [ ] **Step 4:** Run — FAIL. **Step 5:** Реализовать; `sync/maindata?rid=N` раз в секунду. **Step 6:** Run — PASS.
- [ ] **Step 7:** Commit `feat: add torrent store with incremental sync`.

### Task 5: Запуск приложения, UI-примитивы, вход

**Files:**
- Create: `src/App.tsx`, `src/lib/router.ts`, `src/lib/useIsMobile.ts`, `src/components/ui/{Button,IconButton,Field,Toggle,Checkbox,Tabs,Segmented,Dialog,Progress,Chip,Toast,Menu}.tsx` + `.module.css`, `src/features/auth/{LoginScreen,UpgradeScreen}.tsx`, `src/features/shell/ConnectionBanner.tsx`
- Test: `src/App.test.tsx`, `src/features/auth/LoginScreen.test.tsx`, `src/components/ui/Progress.test.tsx`, `src/components/ui/Dialog.test.tsx`

**Interfaces:**
- Produces: `useRoute(): { path: string; navigate(path: string) }`, `useIsMobile(): boolean`, `toast(message: string)`.
- Produces: `<Progress value={0..1} tone="accent"|"done"|"dim" height={10|12|14} />`, `<Dialog title onClose>` с закрытием по Esc, ловушкой фокуса и возвратом фокуса.

- [ ] **Step 1: Failing tests** `App`: `app/version` 200 и API 2.11 → интерфейс; 403 → вход; API 2.9.3 → экран «Нужен qBittorrent 5.0 или новее» с версией; сетевая ошибка при запуске → экран с автоповтором, а не вход. 403 во время работы → вход, и `location.hash` не меняется, поэтому после входа открыт тот же экран.
- [ ] **Step 2: Failing tests** `LoginScreen`: поля с `autocomplete="username"` и `"current-password"`; Enter отправляет; `Fails.` → «Неверный логин или пароль»; 403 → «Слишком много попыток, вход временно заблокирован»; показать/скрыть пароль; адрес = `location.host`; под карточкой `qBit v…`.
- [ ] **Step 3:** Run — FAIL.
- [ ] **Step 4:** Реализовать по `design/Login.dc.html`, примитивы — по разделу «Компоненты» ТЗ. `Progress` — `repeating-linear-gradient` 3px/2px. Вход на мобильной — поля 44px, шрифт 16px (`design/MobileLogin.dc.html`).
- [ ] **Step 5:** Run — PASS.
- [ ] **Step 6:** Commit `feat: add app boot flow, UI primitives and login`.

### Task 6: Сайдбар

**Files:**
- Create: `src/features/torrents/filters.ts`, `src/features/shell/{Sidebar,SpeedCard,Sparkline,DesktopLayout}.tsx` + `.module.css`
- Test: `src/features/torrents/filters.test.ts`, `src/features/shell/Sidebar.test.tsx`

**Interfaces:**
- Produces: `type Filter = {type:'status',value:UiKind|'all'} | {type:'category',value:string} | {type:'tag',value:string}`; `matchesFilter(t, f): boolean`; `countByFilter(torrents): Record<string, number>`.
- Produces: `<DesktopLayout>` — сайдбар и слот контента.

- [ ] **Step 1: Failing tests:** счётчики по таблице «Фильтры» из раздела решений; «В очереди» и «Ошибка» скрыты при нуле и видны при наличии; группы «Категории» и «Теги» скрыты без данных и сворачиваются; торрент «без категории» не падает; карточка показывает лимит из `dl_rate_limit`, при 0 подпись без лимита; тумблер зовёт `toggleSpeedLimitsMode`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Реализовать по `design/Main.dc.html:21-59`; спарклайн — SVG `polyline` из `speedHistory`, при < 2 точек пустой. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add sidebar with filters and speed card`.

### Task 7: Таблица торрентов

**Files:**
- Create: `src/features/torrents/{sortTorrents.ts,TorrentTable.tsx,TorrentRow.tsx,TableHeader.tsx,TopBar.tsx}` + `.module.css`
- Test: `src/features/torrents/sortTorrents.test.ts`, `src/features/torrents/TorrentTable.test.tsx`

**Interfaces:**
- Consumes: `uiStatus`, `matchesFilter`, `useTorrents`, `useUi`.
- Produces: `selectVisible(state, ui): Torrent[]`; `<TorrentRow>` мемоизирован по ссылке на торрент.

- [ ] **Step 1: Failing tests:** по умолчанию `added_on` по убыванию; клик по заголовку меняет колонку и направление; при равных значениях порядок стабилен (по хешу), чтобы строки не прыгали при обновлении; поиск без учёта регистра, кириллица тоже; `/` фокусирует поиск; при обновлении одного торрента остальные строки не перерисовываются (счётчик рендеров); опциональные колонки «№ в очереди», Ratio, Добавлен выключены по умолчанию и хранятся в `localStorage`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Реализовать по `design/Main.dc.html:61-104`: сетка `52px minmax(0,1fr) 140px 220px 110px 84px`, TanStack Virtual с `estimateSize: 48`, раскладка на высоту окна. Кнопка действия пока без обработчика.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add virtualized torrent table with search and sort`.

### Task 8: E2e на настоящем qBittorrent

**Files:**
- Create: `e2e/docker-compose.yml`, `e2e/global-setup.ts`, `e2e/stage1.spec.ts`, `playwright.config.ts`, `e2e/fixtures/` (маленький `.torrent`)
- Modify: `.github/workflows/ci.yml` (job `e2e`)

**Interfaces:**
- Produces: `npm run e2e`; фикстура `qb` с методами `qb.addTorrent(file)`, `qb.prefs()`, `qb.maindata()`; проекты Playwright `desktop` и `iphone` (`devices['iPhone 14']`).

- [ ] **Step 1:** `docker-compose.yml`: `lscr.io/linuxserver/qbittorrent:5.1.2` (версия закреплена), порт 18080, том `../qbit:/qbit:ro`. `global-setup`: читает временный пароль из логов контейнера, через API включает альтернативный WebUI с путём `/qbit`, задаёт пароль теста.
- [ ] **Step 2: Тест** `stage1.spec.ts`: вход → видна таблица; после добавления `.torrent` через API строка появляется без перезагрузки; логин с неверным паролем показывает ошибку; **все запросы страницы идут на тот же origin** (`page.on('request')`).
- [ ] **Step 3:** Run `npm run build && npm run e2e` — PASS. Критерий этапа 1 из ТЗ выполнен.
- [ ] **Step 4:** Зафиксировать результаты живой проверки: `torrents/add` принимает `stopped`, успешный ответ login. Если поведение расходится с разделом «Сверка», поправить клиент и тест Task 3.
- [ ] **Step 5:** Commit `test: add e2e harness against real qBittorrent`.

## Этап 2. Действия

### Task 9: Выбор, действия, контекстное меню

**Files:**
- Create: `src/lib/copyText.ts`, `src/features/torrents/{actions.ts,ContextMenu.tsx}` + `.module.css`
- Modify: `src/features/torrents/{TorrentTable,TorrentRow,TopBar}.tsx`, `src/api/client.ts`
- Test: `src/lib/copyText.test.ts`, `src/features/torrents/actions.test.ts`, `src/features/torrents/ContextMenu.test.tsx`

**Interfaces:**
- Produces: `copyText(text: string): Promise<boolean>`: `navigator.clipboard`, если есть, иначе скрытый `textarea` и `execCommand('copy')`.
- Produces: `runRowAction(t, action)`, `targetHashes(state): string[]` (выбранные, иначе пусто), `pauseAllLabel(torrents): 'pause'|'start'`. Каждое действие после ответа зовёт `refresh()`, ошибка — `toast`.

- [ ] **Step 1: Failing tests:** `copyText` при `navigator.clipboard === undefined` идёт через `execCommand`; `forceStart` шлёт `setForceStart` с `value=true`; «Пауза для всех» при отсутствии выбора шлёт `hashes=all`, при выборе — выбранные; все на паузе → кнопка «Запустить все»; пустой список → кнопка неактивна; Ctrl/Cmd и Shift дают мультивыбор; меню содержит все пункты ТЗ по порядку и применяется ко всем выбранным; правый клик по невыбранной строке выбирает её; меню у края окна не выходит за экран; Категория › и Теги › зовут `setCategory`, `addTags`/`removeTags`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Реализовать, «Скопировать magnet» — через `copyText`. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add torrent actions, multi-select and context menu`.

### Task 10: Удаление и перемещение

**Files:**
- Create: `src/features/torrents/{DeleteDialog,MoveDialog}.tsx` + `.module.css`
- Test: `src/features/torrents/DeleteDialog.test.tsx`, `src/features/torrents/MoveDialog.test.tsx`

**Interfaces:**
- Produces: `useDialogs`: `openDelete(hashes)`, `openMove(hashes)`, `openLimits(tab)`, `openAdd(tab, files?)`; `<DialogHost />`.

- [ ] **Step 1: Failing tests:** чекбокс снят при каждом открытии; заголовок «Удалить торрент?» и «Удалить 3 торрента?» (склонение); сумма `completed` выбранных; `deleteFiles=true` только при отмеченном чекбоксе; `Move` с пустым путём не отправляется, шлёт `setLocation` с `location`.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Реализовать по `design/DeleteDialog.dc.html`; `Move` — в том же стиле, макета нет. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add delete and move dialogs`.

### Task 11: Добавление торрента

**Files:**
- Create: `src/features/add/{bencode.ts,hash.ts,parseTorrent.ts,addFlow.ts,AddDialog.tsx,DropOverlay.tsx,CategorySelect.tsx,TagInput.tsx}` + `.module.css`
- Test: `src/features/add/{bencode,hash,parseTorrent,addFlow}.test.ts`, `src/features/add/AddDialog.test.tsx`

**Interfaces:**
- Produces: `decode(bytes: Uint8Array): BValue`, `sha1(b: Uint8Array): string`, `sha256(b: Uint8Array): string` (JS-реализация, **без `crypto.subtle`**); `parseTorrent(bytes): { name, size, files: {path, size}[], infohash }`, бросает `TorrentParseError`.
- Produces: `addTorrents(req: AddRequest, deps: { api, sleep, now }): Promise<AddResult>`.

- [ ] **Step 1: Failing tests** разбора. `hash.test.ts` сверяет с `node:crypto`. `parseTorrent`: однофайловый v1 и многофайловый; v1 `infohash` = SHA-1 исходных байт `info`, в том числе при лишних ключах и неотсортированном порядке (хешируются байты, не повторное кодирование); v2-only (`file tree`, без `pieces`) `infohash` = первые 40 символов SHA-256; гибрид = SHA-1; обрезанный файл и не-torrent → `TorrentParseError`. С `vi.stubGlobal('crypto', {})` хеш считается.
- [ ] **Step 2: Failing tests** `addFlow` на фейковых таймерах:
  - все файлы отмечены → один `torrents/add` с `stopped` и `paused` по опции;
  - часть снята → добавляется остановленным, опрос до появления infohash, `filePrio` с `priority=0` снятым, `torrents/start` только при «Запустить сразу»;
  - торрент не появился за 30 с → результат с ошибкой, тост;
  - несколько файлов, один неудачный → остальные добавлены, в отчёте имя неудачного;
  - ответ `Fails.` → ошибка «уже добавлен или неверный файл».
- [ ] **Step 3: Failing tests** `AddDialog`: вкладка задаётся при открытии; magnet по ссылке на строку, пустые строки отброшены; повреждённый файл показан с ошибкой и не блокирует остальные; снять все файлы → «Добавить» неактивна; папка по умолчанию из настроек, при выборе категории — её `savePath`; новая категория зовёт `createCategory`; внизу `free_space_on_disk`; перетаскивание `.torrent` на страницу открывает диалог, перетаскивание текста — нет.
- [ ] **Step 4:** Run — FAIL. **Step 5:** Реализовать по `design/AddTorrent.dc.html`; decode хранит смещения `info`. **Step 6:** Run — PASS.
- [ ] **Step 7:** Commit `feat: add torrent dialog with client-side parsing`.

### Task 12: Лимиты скорости

**Files:**
- Create: `src/features/limits/SpeedLimitsDialog.tsx` + `.module.css`, `e2e/limits.spec.ts`
- Modify: `src/features/shell/SpeedCard.tsx` (клик открывает диалог на вкладке «Глобальные»), `src/features/torrents/ContextMenu.tsx`
- Test: `src/features/limits/SpeedLimitsDialog.test.tsx`

**Interfaces:**
- Consumes: `parseLimitMb`, `openLimits`.

- [ ] **Step 1: Failing tests:** «Для торрента» недоступна без выбора; «Глобальные» — `transfer/setDownloadLimit`; «Альтернативные» — `app/setPreferences` с `alt_dl_limit`, `alt_up_limit`; пресеты ∞ 1 5 10 50 подставляют значение и подсвечиваются; `1,5` сохраняется как 1572864; `abc` — ошибка у поля, «Сохранить» неактивна; подсказка, если глобальный лимит ниже лимита торрента.
- [ ] **Step 2: E2e:** задать альтернативный лимит 5 МБ/с, включить альт. режим, `server_state.dl_rate_limit === 5242880`. Если нет — единица в API КиБ/с: исправить конвертацию в диалоге и настройках.
- [ ] **Step 3:** Run — FAIL. **Step 4:** Реализовать по `design/SpeedLimits.dc.html`. **Step 5:** Run — PASS.
- [ ] **Step 6:** Commit `feat: add speed limits dialog`.

## Этап 3. Детали

### Task 13: Карточка деталей

**Files:**
- Create: `src/features/details/{compressPieces.ts,useDetailsPolling.ts,DetailsCard.tsx,PieceMap.tsx}` + `.module.css`
- Test: `src/features/details/compressPieces.test.ts`, `src/features/details/useDetailsPolling.test.ts`, `src/features/details/DetailsCard.test.tsx`

**Interfaces:**
- Produces: `type Cell = 'done'|'active'|'none'`; `compressPieces(states: number[]): Cell[]` (всегда длина 100); `useDetailsPolling(hash, tab): { properties, files, pieces, trackers, peers, peersMeta }`.

- [ ] **Step 1: Failing tests:** `compressPieces([])` → 100 `none`; 5 кусков → 100 ячеек без пустых диапазонов; ячейка с более чем половиной `2` → `done`; `done` важнее `active`; есть `1` при половине и меньше `2` → `active`; 150 000 кусков считается за < 20 мс.
- [ ] **Step 2: Failing tests** опрос: свойства, файлы и куски — 2 с; пиры — 2 с, с `rid`, сброс `rid` при смене торрента; трекеры — 5 с; закрытые вкладки не опрашиваются; смена торрента отбрасывает ответы старого; 404 останавливает опрос без тоста.
- [ ] **Step 3: Failing tests** карточка: без выбора или при нескольких выбранных скрыта; при исчезновении торрента скрывается; magnet без метаданных показывает 0 Б и 0% без `NaN`; иконка «Переместить» открывает `MoveDialog`; «Приостановить»/«Возобновить» по статусу.
- [ ] **Step 4:** Run — FAIL. **Step 5:** Реализовать по `design/Main.dc.html:106-163`, вкладки-заглушки. **Step 6:** Run — PASS.
- [ ] **Step 7:** Commit `feat: add details card with piece map and polling`.

### Task 14: Вкладка «Файлы»

**Files:**
- Create: `src/features/details/{fileTree.ts,FilesTab.tsx}` + `.module.css`
- Test: `src/features/details/fileTree.test.ts`, `src/features/details/FilesTab.test.tsx`

**Interfaces:**
- Produces: `buildTree(files: TorrentFile[]): TreeNode[]`; `TreeNode` содержит `size`, `progress`, `checked: true|false|'mixed'`, `priority: number|'mixed'`, `ids: number[]`; `<FilesTab files onSetPriority variant="desktop"|"mobile" />`.

- [ ] **Step 1: Failing tests:** папки и вложенность из `a/b/c.txt`; размер папки — сумма, прогресс взвешен по размеру; смешанные приоритеты → `'mixed'`; `id` берётся из поля `index`; снятие галки шлёт `filePrio` `priority=0`, установка — `1`; приоритеты 0, 1, 6, 7 подписаны по ТЗ; у папки запрос содержит все вложенные `id` через `|`; 5000 файлов строятся за < 50 мс.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Реализовать; при > 500 строк виртуализация. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add files tab with priorities`.

### Task 15: Трекеры, пиры, сведения, очередь

**Files:**
- Create: `src/features/details/{TrackersTab,PeersTab,InfoTab,Flag}.tsx` + `.module.css`
- Test: `src/features/details/{TrackersTab,PeersTab,InfoTab}.test.tsx`

**Interfaces:**
- Consumes: `copyText` из Task 9.
- Produces: каждая вкладка принимает `variant="desktop"|"mobile"`.

- [ ] **Step 1: Failing tests:** статус трекера 0 → Отключён, 1 и 3 → Обновляется, 2 → Работает, 4 → Ошибка; строки `** [DHT] **`, `[PeX]`, `[LSD]` приглушены и не удаляются; «Добавить трекер» шлёт `addTrackers`, ссылки через перевод строки; удаление — `removeTrackers`; `seeds: -1` показывается как «—». Пиры: сверху «N подключено · M в рое»; инкрементальный `sync/torrentPeers` сливается, `peers_removed` удаляет; пустой `country_code` → без флага и без запроса; подсказка флага — `country`. Сведения: клик по хешу копирует; незаданная дата (`-1`, `0`) → «—».
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Реализовать по `design/Trackers.dc.html`, `design/Peers.dc.html`. `Flag`: `import.meta.glob('/node_modules/flag-icons/flags/4x3/*.svg', { query: '?url', import: 'default' })`, `<img loading="lazy">`. Кнопки очереди и Переместить — в карточке деталей: `increasePrio`, `decreasePrio`.
- [ ] **Step 4:** Run — PASS; `npm run build && npm run check:bundle` в лимите.
- [ ] **Step 5:** Commit `feat: add trackers, peers and info tabs`.

## Этап 4. Настройки

### Task 16: Страница настроек

**Files:**
- Create: `src/features/settings/{schema.ts,diffPrefs.ts,useSettingsDraft.ts,SettingsPage.tsx,SettingRow.tsx,ScheduleEditor.tsx}` + `.module.css`
- Test: `src/features/settings/{schema,diffPrefs}.test.ts`, `src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Produces: `sections: Section[]` из `schema.ts`: `{ id, title, cards: { title, desc, rows: Row[] }[] }`, `Row` с `key`, `kind: 'toggle'|'text'|'number'|'limit'|'select'|'password'`, `visibleIf?`; общий для десктопа и мобильной.
- Produces: `diffPrefs(orig, draft): Partial<Preferences>`; `useSettingsDraft(): { draft, set, dirty, save, reset }`.

Ключи `app/preferences`: `save_path`, `temp_path_enabled`, `temp_path`, `add_stopped_enabled`, `auto_delete_mode`, `max_ratio_enabled`, `max_ratio`, `max_seeding_time_enabled`, `max_seeding_time`; `listen_port`, `upnp`, `max_connec`, `max_connec_per_torrent`, `max_uploads`, `max_uploads_per_torrent`; `dl_limit`, `up_limit`, `alt_dl_limit`, `alt_up_limit`, `scheduler_enabled`, `schedule_from_hour`, `schedule_from_min`, `schedule_to_hour`, `schedule_to_min`, `scheduler_days`; `dht`, `pex`, `lsd`, `encryption`, `anonymous_mode`, `queueing_enabled`, `max_active_downloads`, `max_active_uploads`, `max_active_torrents`; `web_ui_username`, `web_ui_password`, `bypass_local_auth`, `bypass_auth_subnet_whitelist_enabled`, `bypass_auth_subnet_whitelist`, `resolve_peer_countries`. Перед реализацией сверить имена с ответом живого `app/preferences`.

- [ ] **Step 1: Failing tests:** `diffPrefs` возвращает только изменённое; пустой пароль не отправляется вообще; после сохранения `dirty=false`; «Сбросить» возвращает исходное; при `dirty` видна подпись и уход по hash спрашивает подтверждение, `beforeunload` назначен; лимит в КБ/с сохраняется в байт/с; ratio `2,5` → 2.5; порт вне 1–65535 блокирует сохранение; выключенный ratio не шлёт `-1` как значение поля; акцент применяется сразу, пишется в `localStorage` и не делает страницу `dirty`; ошибка сохранения оставляет черновик; «Выйти» зовёт `auth/logout` и показывает вход.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Реализовать по `design/Settings.dc.html`, версия приложения внизу раздела WebUI. **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add settings page`.

## Этап 5. Мобильная версия

### Task 17: Список и action sheet

**Files:**
- Create: `src/features/mobile/{MobileLayout,MobileList,MobileRow,ActionSheet,useLongPress}.tsx` + `.module.css`
- Modify: `src/App.tsx`
- Test: `src/features/mobile/useLongPress.test.ts`, `src/features/mobile/MobileList.test.tsx`

**Interfaces:**
- Produces: `<ActionSheet title items onClose>`; `useLongPress(cb, ms = 500)`; маршрут `#/torrent/<hash>`.

- [ ] **Step 1: Failing tests:** удержание 500 мс открывает sheet с пунктами Пауза/Запустить, Ограничение скорости, Категория, Удалить; сдвиг пальца более 10px отменяет; после удержания обычный клик не срабатывает; тап ведёт на `#/torrent/<hash>`; чипы-фильтры используют `countByFilter`; кнопка альт. лимитов отражает `use_alt_speed_limits`.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Реализовать по `design/Mobile.dc.html`, виртуализация с `estimateSize` по высоте строки макета; `-webkit-touch-callout: none` на строке; все отступы через `env(safe-area-inset-*)`. Меню десктопа и sheet используют одни действия из `actions.ts`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Commit `feat: add mobile list and action sheets`.

### Task 18: Мобильные экраны и PWA

**Files:**
- Create: `src/features/mobile/{MobileDetail,MobileAddSheet,MobileSettings,SettingEditSheet}.tsx` + `.module.css`, `static/manifest.json`, `static/icons/{icon-192,icon-512,apple-touch-icon}.png`, `e2e/mobile.spec.ts`
- Modify: `index.html`
- Test: `src/features/mobile/MobileSettings.test.tsx`

**Interfaces:**
- Consumes: `sections` и `useSettingsDraft` из Task 16, `addTorrents` из Task 11, вкладки `variant="mobile"` из Task 14–15.

- [ ] **Step 1: Failing tests** `MobileSettings`: группы и строки макета `design/MobileSettings.dc.html`, тумблер меняет черновик, тап по значению открывает sheet, «Сохранить» отправляет только изменённое.
- [ ] **Step 2: E2e** `mobile.spec.ts`, проект `iphone`: у всех `input, textarea, select` на всех экранах `font-size ≥ 16px`; имя торрента `font-size` = 14px при длинном имени; у интерактивных элементов высота ≥ 44px; нет горизонтальной прокрутки страницы; `manifest.json` отдаётся и содержит `display: standalone`, `theme_color: #09090B`.
- [ ] **Step 3:** Run — FAIL.
- [ ] **Step 4:** Реализовать по `design/MobileDetail.dc.html`, `design/MobileAdd.dc.html`. Подписи приоритетов на мобильной — короткие из макета («Макс.», «Не качать»). В `index.html`: `viewport-fit=cover`, `theme-color`, ссылка на manifest. Manifest: `start_url: "."`, `scope: "."`.
- [ ] **Step 5:** Run — PASS.
- [ ] **Step 6:** Commit `feat: add mobile screens and PWA manifest`.

## Этап 6. Полировка и релизы

### Task 19: Клавиатура, состояния, производительность

**Files:**
- Create: `src/lib/useHotkeys.ts`, `src/features/torrents/EmptyState.tsx`, `e2e/perf.spec.ts`, `e2e/acceptance.spec.ts`
- Test: `src/lib/useHotkeys.test.ts`, `src/features/torrents/EmptyState.test.tsx`

**Interfaces:**
- Consumes: стор, `useDialogs`, `actions.ts`.

- [ ] **Step 1: Failing tests:** ↑/↓ двигают выбор и прокручивают; Enter — детали; Пробел — пауза/пуск и не прокручивает страницу и не жмёт кнопку в фокусе дважды; Delete открывает удаление; **на Mac клавиша delete приходит как Backspace — тоже открывает удаление, если фокус не в поле**; `/` — поиск; в полях ввода горячие клавиши не срабатывают; при открытом диалоге работает только Esc. Состояния: пустой список — «Торрентов пока нет» и «Добавить»; нет совпадений — отдельное сообщение.
- [ ] **Step 2: E2e** `perf.spec.ts`: подменить `sync/maindata` на 1000 торрентов с обновлением 50 за секунду; в DOM менее 60 строк; долгих задач > 100 мс при прокрутке нет. `acceptance.spec.ts`: Network на всех экранах — только свой origin; потеря связи (`page.route` abort) даёт плашку «Нет соединения, повторяем…», после восстановления она исчезает, экран входа не появляется.
- [ ] **Step 3:** Run — FAIL. **Step 4:** Реализовать; при расхождении с критериями — профилировать, а не ослаблять тест. **Step 5:** Run — PASS.
- [ ] **Step 6:** Сверить все экраны с макетами: Playwright-снимок рядом с артбордом при тех же размерах (1440×900, 390×844); расхождения по цветам, шрифтам, размерам, отступам исправить.
- [ ] **Step 7:** Commit `feat: add hotkeys, empty states and performance checks`.

### Task 20: Релизы и README

**Files:**
- Create: `.github/workflows/release.yml`, `Dockerfile.mod`, `cliff.toml`, `README.md`

**Interfaces:**
- Produces: `qbit.zip` с `qbit/public/…`; ветка `latest-release`; `ghcr.io/<owner>/qbit-mod:{latest,X.Y.Z}`.

- [ ] **Step 1:** `release.yml` на тег `v*`: `APP_VERSION` из тега без `v`, сборка, `qbit.zip`, GitHub Release с changelog (git-cliff, Conventional Commits). Затем содержимое `qbit/` — force-push в ветку `latest-release` из одного коммита. Затем `docker/build-push-action` с `GITHUB_TOKEN`, `permissions: contents: write, packages: write`. **Имя образа приводится к нижнему регистру:** GHCR отклоняет владельца с заглавными.
- [ ] **Step 2:** `Dockerfile.mod`: `FROM scratch`, `COPY qbit /qbit`.
- [ ] **Step 3:** Проверка мода локально: `npm run build && docker build -f Dockerfile.mod -t qbit-mod:test .`, затем `docker save qbit-mod:test | tar -tv` и проверка слоя: в нём есть `qbit/public/index.html`. Проверка архива: `zip -sf qbit.zip | grep qbit/public/index.html`. `.dockerignore` не исключает `qbit/`.
- [ ] **Step 4:** `README.md`: бейджи CI и релиза, три способа установки из раздела «Подключение» ТЗ, `qBittorrent.conf`, обновление, откат, разработка через `QBIT_URL`.
- [ ] **Step 5:** Commit `ci: add release workflow, Docker mod and README`.
- [ ] **Step 6:** После создания репозитория на GitHub тег `v0.1.0` проверяет весь путь. Создание репозитория и пуш — только с согласия пользователя.
