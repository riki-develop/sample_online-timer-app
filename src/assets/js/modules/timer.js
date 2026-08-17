import { createAlarmPlayer } from './audio.js';
import { createMemoHistory } from './history.js';

const DEFAULT_MINUTES = 10;
const HOURGLASS = {
  left: 10,
  right: 110,
  topY: 14,
  centerY: 100,
  bottomY: 186,
  neckLeft: 54,
  neckRight: 66,
};
const HOURGLASS_INSET = HOURGLASS.neckLeft - HOURGLASS.left;
const HOURGLASS_CHAMBER_HEIGHT = HOURGLASS.centerY - HOURGLASS.topY;

const formatTime = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
};

export const TimerApp = () => {
  const root = document.querySelector('.timer-app');
  if (!root) return;

  const minutesSlider = root.querySelector('#timer-minutes');
  const minutesValue = root.querySelector('#timer-minutes-value');
  const memoInput = root.querySelector('#timer-memo');
  const message = root.querySelector('[data-role="message"]');
  const setupPanel = root.querySelector('[data-role="setup-panel"]');
  const runningPanel = root.querySelector('[data-role="running-panel"]');
  const startButton = root.querySelector('[data-role="start"]');
  const pauseButton = root.querySelector('[data-role="pause"]');
  const resetButton = root.querySelector('[data-role="reset"]');
  const soundToggleButton = root.querySelector('[data-role="sound-toggle"]');
  const historyOpenButton = root.querySelector('[data-role="history-open"]');
  const remaining = root.querySelector('[data-role="remaining"]');
  const sandUpper = root.querySelector('[data-role="sand-upper"]');
  const sandLower = root.querySelector('[data-role="sand-lower"]');
  const sandParticles = root.querySelector('[data-role="sand-particles"]');
  const hourglassSvg = root.querySelector('[data-role="hourglass-svg"]');

  if (
    !minutesSlider ||
    !minutesValue ||
    !memoInput ||
    !message ||
    !setupPanel ||
    !runningPanel ||
    !startButton ||
    !pauseButton ||
    !resetButton ||
    !soundToggleButton ||
    !historyOpenButton ||
    !remaining ||
    !sandUpper ||
    !sandLower
  ) {
    return;
  }

  const alarm = createAlarmPlayer();
  const memoHistory = createMemoHistory(root);

  const state = {
    selectedMinutes: DEFAULT_MINUTES,
    remainingSeconds: DEFAULT_MINUTES * 60,
    totalSeconds: DEFAULT_MINUTES * 60,
    isRunning: false,
    isPaused: false,
    isFinished: false,
    timerId: null,
    flipTimerId: null,
    endTimeMs: 0,
    wakeLock: null,
    soundEnabled: true,
    activeHistoryId: null,
  };

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator) || state.wakeLock) {
      return;
    }

    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      state.wakeLock.addEventListener('release', () => {
        state.wakeLock = null;
      });
    } catch {
      state.wakeLock = null;
    }
  };

  const releaseWakeLock = () => {
    if (!state.wakeLock) {
      return;
    }

    const lock = state.wakeLock;
    state.wakeLock = null;
    lock.release().catch(() => {});
  };

  const stopTicker = () => {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  };

  // 砂時計の砂ポリゴンを進捗 p (0〜1) に応じて更新する
  // ガラス壁の傾きに合わせて頂点を計算するため、はみ出しが起きない
  const updateSand = (p) => {
    const c = Math.min(1, Math.max(0, p));
    const inset = c * HOURGLASS_INSET; // 壁に沿ったX方向の内側シフト量
    const lx = HOURGLASS.left + inset;
    const rx = HOURGLASS.right - inset;
    const uy = HOURGLASS.topY + c * HOURGLASS_CHAMBER_HEIGHT;
    const ly = HOURGLASS.bottomY - c * HOURGLASS_CHAMBER_HEIGHT;

    sandUpper.setAttribute(
      'points',
      `${lx},${uy} ${rx},${uy} ${HOURGLASS.neckRight},${HOURGLASS.centerY} ${HOURGLASS.neckLeft},${HOURGLASS.centerY}`,
    );
    sandLower.setAttribute(
      'points',
      `${lx},${ly} ${rx},${ly} ${HOURGLASS.right},${HOURGLASS.bottomY} ${HOURGLASS.left},${HOURGLASS.bottomY}`,
    );
  };

  // SVG が 180° 回転した状態での砂更新
  // 視覚上部（SVG lower）は上端から減り、
  // 視覚下部（SVG upper）は底辺 y=14 から溜まる形で描く
  const updateSandFlipped = (p) => {
    const c = Math.min(1, Math.max(0, p));

    // 視覚上部（SVG lower chamber）: 砂が減る側
    // c=0 で満杯、c=1 で首元まで減る。180° 回転後は砂面が上から下がる。
    const cs = 1 - c;
    const sly = HOURGLASS.centerY + cs * HOURGLASS_CHAMBER_HEIGHT;
    sandLower.setAttribute(
      'points',
      `${HOURGLASS.neckLeft},${HOURGLASS.centerY} ${HOURGLASS.neckRight},${HOURGLASS.centerY} ${HOURGLASS.neckRight + cs * HOURGLASS_INSET},${sly} ${HOURGLASS.neckLeft - cs * HOURGLASS_INSET},${sly}`,
    );

    // 視覚下部（SVG upper chamber）: 砂が溜まる側
    // 底辺を y=14（視覚的な床）にすることで「下から積み上がる」見た目にする
    // c=0 で空（surface=y14, 縮退）、c=1 で満杯（surface=y100）
    const duy = HOURGLASS.topY + c * HOURGLASS_CHAMBER_HEIGHT;
    sandUpper.setAttribute(
      'points',
      `${HOURGLASS.left},${HOURGLASS.topY} ${HOURGLASS.right},${HOURGLASS.topY} ${HOURGLASS.right - c * HOURGLASS_INSET},${duy} ${HOURGLASS.left + c * HOURGLASS_INSET},${duy}`,
    );
  };

  const render = () => {
    minutesValue.textContent = `${state.selectedMinutes}分`;
    remaining.textContent = formatTime(state.remainingSeconds);
    soundToggleButton.setAttribute('aria-pressed', String(state.soundEnabled));
    soundToggleButton.textContent = `音声: ${state.soundEnabled ? 'ON' : 'OFF'}`;
    historyOpenButton.hidden = state.isRunning || state.flipTimerId !== null;

    if (state.isRunning) {
      setupPanel.hidden = true;
      runningPanel.hidden = false;
      pauseButton.hidden = false;
      pauseButton.textContent = state.isPaused ? '再開' : '一時停止';

      const rawProgress =
        state.totalSeconds > 0
          ? (state.totalSeconds - state.remainingSeconds) / state.totalSeconds
          : 0;
      const p = Math.min(1, Math.max(0, rawProgress));

      // SVG が 180° 回転済み → flipped 用関数で視覚的に正しい砂形状を描く
      updateSandFlipped(p);

      if (sandParticles) {
        sandParticles.classList.toggle('is-active', !state.isPaused);
      }
      if (hourglassSvg) {
        if (state.isPaused) {
          hourglassSvg.pauseAnimations();
        } else {
          hourglassSvg.unpauseAnimations();
        }
      }
      return;
    }

    if (state.isFinished) {
      setupPanel.hidden = true;
      runningPanel.hidden = false;
      pauseButton.hidden = true;
      // SVG は 180° のまま。flipped 用で視覚的な下部に砂が溜まった状態を描く
      updateSandFlipped(1);
      if (sandParticles) sandParticles.classList.remove('is-active');
      if (hourglassSvg) hourglassSvg.pauseAnimations();
      return;
    }

    setupPanel.hidden = false;
    runningPanel.hidden = true;
    pauseButton.hidden = false;
    // 初期状態：砂が下部に溜まっている（スタート前の砂時計）
    updateSand(1);
    if (sandParticles) sandParticles.classList.remove('is-active');
    if (hourglassSvg) hourglassSvg.unpauseAnimations();
  };

  const setMessage = (text = '') => {
    message.textContent = text;
    message.classList.toggle('timer-app__message--visible', Boolean(text));
  };

  const resetToInitialState = () => {
    if (state.isRunning) {
      memoHistory.finish(state.activeHistoryId, 'incomplete');
    }
    state.activeHistoryId = null;
    stopTicker();
    releaseWakeLock();
    if (state.flipTimerId !== null) {
      window.clearTimeout(state.flipTimerId);
      state.flipTimerId = null;
    }
    state.isRunning = false;
    state.isPaused = false;
    state.isFinished = false;
    state.remainingSeconds = state.selectedMinutes * 60;
    if (hourglassSvg) hourglassSvg.classList.remove('is-flipped');
    setMessage('');
    render();
  };

  const finishCountdown = () => {
    memoHistory.finish(state.activeHistoryId, 'completed');
    state.activeHistoryId = null;
    stopTicker();
    releaseWakeLock();
    state.isRunning = false;
    state.isPaused = false;
    state.isFinished = true;
    state.remainingSeconds = 0;

    if (state.soundEnabled) {
      alarm.play();
    }

    setMessage('終了しました');
    render();
  };

  const tick = () => {
    const nextSeconds = Math.max(
      0,
      Math.ceil((state.endTimeMs - Date.now()) / 1000),
    );
    if (nextSeconds === state.remainingSeconds) {
      return;
    }

    state.remainingSeconds = nextSeconds;
    render();

    if (state.remainingSeconds <= 0) {
      finishCountdown();
    }
  };

  const startTicker = () => {
    state.endTimeMs = Date.now() + state.remainingSeconds * 1000;
    stopTicker();
    state.timerId = window.setInterval(tick, 250);
  };

  const start = () => {
    // フリップ中または実行中は受け付けない
    if (state.isRunning || state.flipTimerId !== null) return;

    alarm.prime();
    requestWakeLock();
    setMessage('');
    state.isFinished = false;

    // 砂時計を 180° 回転させる（CSS transition で animate）
    if (hourglassSvg) hourglassSvg.classList.add('is-flipped');

    // 回転アニメ完了後にタイマーを開始
    state.flipTimerId = window.setTimeout(() => {
      state.flipTimerId = null;
      state.isRunning = true;
      state.isPaused = false;
      state.remainingSeconds = state.selectedMinutes * 60;
      state.totalSeconds = state.selectedMinutes * 60;
      state.activeHistoryId = memoHistory.start(memoInput.value);
      memoInput.value = '';
      startTicker();
      render();
    }, 600);
    render();
  };

  const togglePause = () => {
    if (!state.isRunning) return;

    if (state.isPaused) {
      state.isPaused = false;
      requestWakeLock();
      startTicker();
      render();
      return;
    }

    state.isPaused = true;
    stopTicker();
    releaseWakeLock();
    render();
  };

  minutesSlider.addEventListener('input', () => {
    const value = Number(minutesSlider.value);
    state.selectedMinutes = Math.min(60, Math.max(1, value));

    if (!state.isRunning) {
      state.remainingSeconds = state.selectedMinutes * 60;
    }

    render();
  });

  soundToggleButton.addEventListener('click', () => {
    alarm.prime();
    state.soundEnabled = !state.soundEnabled;
    render();
  });

  startButton.addEventListener('click', start);
  pauseButton.addEventListener('click', togglePause);
  resetButton.addEventListener('click', resetToInitialState);
  document.addEventListener('visibilitychange', () => {
    if (
      document.visibilityState === 'visible' &&
      state.isRunning &&
      !state.isPaused
    ) {
      requestWakeLock();
    }
  });

  render();
};
