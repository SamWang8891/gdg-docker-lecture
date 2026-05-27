// 這段 JS 會被 Vite bundle 成 production-ready 的 JS 檔
// 在 multi-stage Dockerfile 裡：
//   - builder stage 跑 npm run build 產出 dist/
//   - runtime stage 只 copy dist/，不帶 node_modules

const info = document.getElementById('info');
info.textContent = `Page loaded at: ${new Date().toISOString()}`;
