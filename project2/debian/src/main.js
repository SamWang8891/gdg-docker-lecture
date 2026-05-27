// 這個 main.js 會被 Vite bundle 成 production-ready 的 JS
// 在 multi-stage Dockerfile 裡，build stage 跑 npm run build
// runtime stage 只 copy 最終的 dist/，不帶 node_modules

const buildTime = new Date().toISOString();

document.getElementById('info').textContent =
    `Page loaded at: ${buildTime}`;
