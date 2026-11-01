export const t = {
  app: {
    name: 'qBit',
  },
  units: {
    bytes: ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'],
    perSecond: '/с',
  },
  eta: {
    infinite: '∞',
    lessThanMinute: '< 1 мин',
    minutes: 'мин',
    hours: 'ч',
    days: 'д',
  },
  plural: {
    peers: ['пир', 'пира', 'пиров'] as [string, string, string],
  },
  status: {
    downloading: 'Скачивается',
    seeding: 'Раздаётся',
    done: 'Готово',
    paused: 'Пауза',
    queued: 'В очереди',
    checking: 'Проверка',
    moving: 'Перемещение',
    error: 'Ошибка',
  },
  statusSub: {
    searchingPeers: 'Ищет пиров',
    waitingInQueue: 'Ждёт своей очереди',
    remaining: 'осталось',
    uploaded: 'отдано',
    of: 'из',
    errorText: 'Ошибка',
    missingFiles: 'Файлы не найдены',
  },
}
