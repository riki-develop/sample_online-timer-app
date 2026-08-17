import { initAnimation } from './modules/animation.js';
import { TimerApp } from './modules/timer.js';

const initApp = () => {
  initAnimation();
  TimerApp();
};
document.addEventListener('DOMContentLoaded', initApp);
