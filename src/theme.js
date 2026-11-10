// Applies the saved light/dark theme before first paint without inline script tags,
// keeping Content-Security-Policy `script-src 'self'` strict.
(() => {
  let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    const saved = localStorage.getItem('mona-patrol-theme');
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch {
    // Storage may be unavailable in restricted contexts.
  }
  document.documentElement.dataset.theme = theme;
})();
