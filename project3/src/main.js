// 這段 JS 會被 Vite bundle 成 production-ready 的 JS 檔
// 在 multi-stage Dockerfile 裡：
//   - builder stage 跑 npm run build 產出 dist/
//   - runtime stage 只 copy dist/，不帶 node_modules
import './style.css';

const fmt = (d) =>
  d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

// build-time timestamp — replaced by Vite at build, frozen into the bundle
const builtAt = new Date(__BUILD_TIME__);
document.getElementById('built').textContent = fmt(builtAt);

const loaded = new Date();
document.getElementById('loaded').textContent = fmt(loaded);

document.addEventListener('DOMContentLoaded', () => {
  const ms = performance.now().toFixed(1);
  document.getElementById('ready').textContent = ms + ' ms';

  // animate size bars after first paint
  requestAnimationFrame(() => {
    document.querySelectorAll('.bar-fill').forEach((el) => {
      const w = parseFloat(el.dataset.w);
      el.style.width = w + '%';
    });
  });
});
