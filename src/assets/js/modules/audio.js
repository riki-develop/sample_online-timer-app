export const createAlarmPlayer = () => {
  let audioContext = null;

  const getAudioContext = () => {
    if (audioContext) {
      return audioContext;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return null;
    }

    audioContext = new Ctx();
    return audioContext;
  };

  const prime = async () => {
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Ignore resume errors and keep app usable without sound.
      }
    }
  };

  const playBeep = (ctx, startTime, frequency, duration) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    gain.connect(ctx.destination);

    const oscillator = ctx.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.connect(gain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);

    return oscillator;
  };

  const play = async () => {
    await prime();
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }

    const now = ctx.currentTime;
    const beepDuration = 0.15;
    const pauseDuration = 0.1;
    const cycleCount = 3;

    // アラームらしい「ピピピ」パターンを3セット繰り返す
    for (let cycle = 0; cycle < cycleCount; cycle++) {
      const cycleStart = now + cycle * 1.0;

      // 高音
      playBeep(ctx, cycleStart, 1200, beepDuration);
      // 低音
      playBeep(
        ctx,
        cycleStart + beepDuration + pauseDuration,
        900,
        beepDuration,
      );
      // 高音
      playBeep(
        ctx,
        cycleStart + (beepDuration + pauseDuration) * 2,
        1200,
        beepDuration,
      );
    }
  };

  return {
    prime,
    play,
  };
};
