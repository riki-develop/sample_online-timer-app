const STORAGE_KEY = 'online-timer:memo-history';
const MAX_HISTORY_COUNT = 10;
const MAX_MEMO_LENGTH = 50;
const VALID_STATUSES = new Set(['running', 'completed', 'incomplete']);

const isValidDateString = (value) =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime());

const isValidHistoryEntry = (entry) =>
  entry !== null &&
  typeof entry === 'object' &&
  typeof entry.id === 'string' &&
  typeof entry.memo === 'string' &&
  isValidDateString(entry.startedAt) &&
  (entry.endedAt === null || isValidDateString(entry.endedAt)) &&
  VALID_STATUSES.has(entry.status);

const readHistory = () => {
  try {
    const storedValue = window.localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return [];

    const history = JSON.parse(storedValue);
    return Array.isArray(history) ? history.filter(isValidHistoryEntry) : [];
  } catch {
    return [];
  }
};

const writeHistory = (history) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
};

const sortNewestFirst = (history) =>
  [...history].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

const createId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatDateTime = (dateString) => {
  if (!dateString) return '—';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const statusLabels = {
  running: '計測中',
  completed: '完了',
  incomplete: '未完',
};

export const createMemoHistory = (root) => {
  const openButton = root.querySelector('[data-role="history-open"]');
  const closeButton = root.querySelector('[data-role="history-close"]');
  const dialog = root.querySelector('[data-role="history-dialog"]');
  const list = root.querySelector('[data-role="history-list"]');
  const emptyMessage = root.querySelector('[data-role="history-empty"]');

  if (!openButton || !closeButton || !dialog || !list || !emptyMessage) {
    return {
      start: () => null,
      finish: () => {},
    };
  }

  const render = () => {
    const history = sortNewestFirst(readHistory());
    list.replaceChildren();
    emptyMessage.hidden = history.length > 0;

    for (const entry of history) {
      const item = document.createElement('li');
      item.className = 'timer-app__history-item';

      const header = document.createElement('div');
      header.className = 'timer-app__history-item-header';

      const memo = document.createElement('p');
      memo.className = 'timer-app__history-memo';
      memo.textContent = entry.memo;

      const deleteButton = document.createElement('button');
      deleteButton.className = 'timer-app__history-delete';
      deleteButton.type = 'button';
      deleteButton.dataset.historyId = entry.id;
      deleteButton.textContent = '削除';
      deleteButton.setAttribute('aria-label', `「${entry.memo}」を削除`);

      const meta = document.createElement('p');
      meta.className = 'timer-app__history-meta';

      const status = document.createElement('span');
      status.className = 'timer-app__history-status';
      if (entry.status === 'incomplete') {
        status.classList.add('is-incomplete');
      }
      status.textContent = statusLabels[entry.status] ?? '未完';

      const date = document.createElement('span');
      date.textContent = `${formatDateTime(entry.startedAt)} ～ ${formatDateTime(entry.endedAt)}`;

      header.append(memo, deleteButton);
      meta.append(status, date);
      item.append(header, meta);
      list.append(item);
    }
  };

  const reconcileRunningEntries = () => {
    const now = new Date().toISOString();
    const history = readHistory();
    let hasRunningEntry = false;

    const reconciled = history.map((entry) => {
      if (entry.status !== 'running') return entry;
      hasRunningEntry = true;
      return { ...entry, endedAt: now, status: 'incomplete' };
    });

    if (hasRunningEntry) writeHistory(reconciled);
  };

  const start = (memoValue) => {
    const memo = memoValue.trim();
    if (!memo) return null;

    const entry = {
      id: createId(),
      memo: memo.slice(0, MAX_MEMO_LENGTH),
      startedAt: new Date().toISOString(),
      endedAt: null,
      status: 'running',
    };
    const nextHistory = sortNewestFirst([entry, ...readHistory()]).slice(
      0,
      MAX_HISTORY_COUNT,
    );

    return writeHistory(nextHistory) ? entry.id : null;
  };

  const finish = (id, status) => {
    if (!id) return;

    const now = new Date().toISOString();
    const history = readHistory();
    const nextHistory = history.map((entry) =>
      entry.id === id ? { ...entry, endedAt: now, status } : entry,
    );
    writeHistory(nextHistory);
  };

  openButton.addEventListener('click', () => {
    render();
    dialog.showModal();
  });

  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  list.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-history-id]');
    if (!deleteButton) return;

    const nextHistory = readHistory().filter(
      (entry) => entry.id !== deleteButton.dataset.historyId,
    );
    writeHistory(nextHistory);
    render();
  });

  reconcileRunningEntries();

  return { start, finish };
};
