// 共通ユーティリティ

const app = document.getElementById('app');

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function uid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function formatDuration(sec) {
  sec = Math.round(sec || 0);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function formatCount(n) {
  n = Number(n) || 0;
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '億';
  if (n >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万';
  return String(n);
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  const units = [[31536000, '年'], [2592000, 'か月'], [604800, '週間'], [86400, '日'], [3600, '時間'], [60, '分']];
  for (const [sec, label] of units) {
    if (diff >= sec) return `${Math.floor(diff / sec)}${label}前`;
  }
  return 'たった今';
}

function avatarColor(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

function avatarHtml(name, size = 36) {
  return `<span class="avatar" style="background:${avatarColor(name)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${esc(String(name).charAt(0).toUpperCase())}</span>`;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function emptyHtml(title, body = '') {
  return `<div class="empty"><h2>${esc(title)}</h2>${body}</div>`;
}

function cardHtml(v, compact = false) {
  return `
    <a class="card" href="#/watch/${v.id}">
      <div class="thumb">
        <img src="${publicUrl('thumbnails', v.thumbnail_path)}" alt="" loading="lazy">
        <span class="duration">${formatDuration(v.duration)}</span>
      </div>
      <div class="meta">
        ${compact ? '' : avatarHtml(v.display_name)}
        <div>
          <h3 class="title">${esc(v.title)}</h3>
          <div class="sub">${esc(v.display_name)}<br>${formatCount(v.views)} 回視聴・${timeAgo(v.created_at)}</div>
        </div>
      </div>
    </a>`;
}
