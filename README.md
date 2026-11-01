# qBit

[![CI](https://github.com/Ivan-Kuzmichev/qbit/actions/workflows/ci.yml/badge.svg)](https://github.com/Ivan-Kuzmichev/qbit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Ivan-Kuzmichev/qbit)](https://github.com/Ivan-Kuzmichev/qbit/releases/latest)

Альтернативный WebUI для qBittorrent. Статическое приложение: подключается к qBittorrent как «альтернативный WebUI», образ qBittorrent пересобирать не нужно.

## Установка

Во всех случаях в qBittorrent нужно включить «Использовать альтернативный WebUI» (Настройки, Web UI) и указать путь к папке `qbit`, внутри которой лежит `public`.

### 1. Docker mod (для `lscr.io/linuxserver/qbittorrent`)

Добавить переменную и пересоздать контейнер:

```yaml
environment:
  - DOCKER_MODS=ghcr.io/ivan-kuzmichev/qbit-mod:latest
```

Путь альтернативного WebUI: `/qbit`. Чтобы закрепить версию, укажите тег вместо `latest`, например `qbit-mod:0.1.0`.

### 2. Архив из релиза (любой образ)

Скачать `qbit.zip` со [страницы релиза](https://github.com/Ivan-Kuzmichev/qbit/releases/latest), распаковать на хосте и примонтировать:

```yaml
volumes:
  - ./qbit:/qbit:ro
```

Путь: `/qbit`.

### 3. Git

```sh
git clone --single-branch -b latest-release https://github.com/Ivan-Kuzmichev/qbit ./qbit
```

Монтирование и путь такие же, как во втором способе.

### Через `qBittorrent.conf`

Вместо галки в настройках:

```ini
WebUI\AlternativeUIEnabled=true
WebUI\RootFolder=/qbit
```

После правки перезапустите контейнер.

## Обновление

- Docker mod: `docker compose up -d --force-recreate` (для `latest`; при закреплённом теге сначала смените тег).
- Архив: заменить содержимое папки `qbit` и обновить страницу в браузере.
- Git: `git -C ./qbit pull`.

## Откат

Снять галку «Использовать альтернативный WebUI»: вернётся стандартный интерфейс. Для Docker mod дополнительно убрать `DOCKER_MODS` и пересоздать контейнер. Если WebUI сломан и в настройки не попасть, выключить опцию в `qBittorrent.conf` (`WebUI\AlternativeUIEnabled=false`) и перезапустить контейнер. Чтобы вернуться на прежнюю версию, используйте тег предыдущего релиза (`qbit-mod:X.Y.Z` или `qbit.zip` из старого релиза).

## Разработка

Нужен Node.js 22.

```sh
npm ci
cp .env.example .env   # QBIT_URL=http://nas.local:8080
npm run dev
```

Dev-сервер проксирует `/api` на qBittorrent по адресу из `QBIT_URL` и подменяет `Origin`, `Referer` и `Host`, поэтому защиту от CSRF и проверку Host в qBittorrent отключать не нужно.

Сборка: `npm run build` (результат в `qbit/public`). Версия берётся из `package.json` или из переменной `APP_VERSION`.

### Тесты

```sh
npm test         # unit-тесты (vitest)
npm run e2e      # e2e (Playwright), нужна предварительная npm run build
npm run visual   # визуальные тесты
```

Также: `npm run typecheck`, `npm run lint`, `npm run check:bundle`.

## Релизы

Тег `v*` запускает `.github/workflows/release.yml`: сборка, `qbit.zip` и GitHub Release с changelog (git-cliff по Conventional Commits), ветка `latest-release` (один коммит, force-push) и образ `ghcr.io/<owner>/qbit-mod` с тегами `latest` и `X.Y.Z`.
