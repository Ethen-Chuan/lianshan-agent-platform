window.LIANSHAN_PUBLIC_DEMO = true;

document.addEventListener('DOMContentLoaded', () => {
  const decorate = () => {
    const label = document.querySelector('.demo-pill');
    if (!label || label.dataset.publicNotice === 'true') return;
    const help = document.createElement('a');
    help.className = 'demo-pill';
    help.dataset.publicNotice = 'true';
    help.href = 'about.html';
    help.target = '_blank';
    help.rel = 'noopener';
    help.textContent = '在线演示 · 合成数据';
    help.title = '查看使用说明：数据仅保存在当前浏览器，不接入真实模型或生产业务。';
    help.setAttribute('aria-label', '在线演示使用说明，在新页面打开');
    label.replaceWith(help);
  };
  decorate();
  const app = document.getElementById('app');
  if (app) new MutationObserver(decorate).observe(app, {childList: true, subtree: true});
});
