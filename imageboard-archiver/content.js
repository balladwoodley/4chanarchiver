// content.js — injected on supported imageboard thread pages
// Adds a small floating button for quick access

(function () {
  if (document.getElementById('farch-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'farch-btn';
  btn.innerHTML = '◈';
  btn.title = 'Thread Archiver';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 36px;
    height: 36px;
    background: #444;
    color: #fff;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 99999;
    border: 2px solid #666;
    font-family: monospace;
    transition: all 0.15s;
    user-select: none;
  `;

  btn.addEventListener('mouseenter', () => { btn.style.background = '#666'; btn.style.transform = 'scale(1.1)'; });
  btn.addEventListener('mouseleave', () => { btn.style.background = '#444'; btn.style.transform = 'scale(1)'; });
  btn.addEventListener('click', () => { btn.innerHTML = '✓'; setTimeout(() => { btn.innerHTML = '◈'; }, 800); });

  document.body.appendChild(btn);
})();
