export const initAnimation = () => {
  const root = document.querySelector('.timer-app');
  if (!root) return;

  window.requestAnimationFrame(() => {
    root.classList.add('is-ready');
  });
};
