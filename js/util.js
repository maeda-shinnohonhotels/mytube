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
  return n.toLocaleString('ja-JP');
}

function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
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
  return `<span class="avatar" style="background:${avatarColor(name)};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px" aria-hidden="true">${esc(String(name).charAt(0).toUpperCase())}</span>`;
}

function toast(msg, type = '') {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function emptyHtml(title, body = '', icon = '') {
  return `<div class="empty">${icon ? `<div class="empty-icon">${icon}</div>` : ''}<h2>${esc(title)}</h2>${body}</div>`;
}

function errorHtml(err) {
  console.error(err);
  return emptyHtml('読み込みに失敗しました',
    `<p class="sub">通信状況を確認して、もう一度お試しください。</p>
     <button class="btn" onclick="route()">再読み込み</button>`, '⚠');
}

// Supabase のエラーを利用者向けの日本語にする
function friendlyError(err) {
  const msg = String(err?.message || err || '');
  if (/Invalid login credentials/i.test(msg)) return 'メールアドレスまたはパスワードが違います';
  if (/Email not confirmed/i.test(msg)) return 'メールアドレスの確認が完了していません。届いたメールのリンクを開いてください';
  if (/already registered|already been registered/i.test(msg)) return 'このメールアドレスはすでに登録されています';
  if (/rate limit|too many/i.test(msg)) return '操作が多すぎます。しばらく待ってからお試しください';
  if (/Password should be/i.test(msg)) return 'パスワードは6文字以上にしてください';
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'メールアドレスの形式が正しくありません';
  if (/row-level security|violates/i.test(msg)) return '権限がないか、保存できる容量（300MB）を超えています';
  if (/Failed to fetch|NetworkError|ネットワーク/i.test(msg)) return '通信エラーが発生しました。接続を確認してください';
  return msg || 'エラーが発生しました';
}

function skeletonGrid(n = 12) {
  return `<div class="grid">${Array.from({ length: n }, () => `
    <div class="card skeleton">
      <div class="thumb"></div>
      <div class="meta"><span class="sk-circle"></span><div class="sk-lines"><span></span><span></span></div></div>
    </div>`).join('')}</div>`;
}

function cardHtml(v, compact = false) {
  return `
    <a class="card" href="#/watch/${esc(v.id)}">
      <div class="thumb">
        <img src="${esc(publicUrl('thumbnails', v.thumbnail_path))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        <span class="duration">${formatDuration(v.duration)}</span>
      </div>
      <div class="meta">
        ${compact ? '' : avatarHtml(v.display_name)}
        <div class="meta-text">
          <h3 class="title" title="${esc(v.title)}">${esc(v.title)}</h3>
          <div class="sub">${esc(v.display_name)}<br>${formatCount(v.views)} 回視聴・${timeAgo(v.created_at)}</div>
        </div>
      </div>
    </a>`;
}

function setTitle(title) {
  document.title = title ? `${title} - MyTube` : 'MyTube';
}

// テキストエリアを内容に合わせて伸ばす
function autoGrow(textarea) {
  const fit = () => { textarea.style.height = 'auto'; textarea.style.height = `${textarea.scrollHeight}px`; };
  textarea.addEventListener('input', fit);
  fit();
}

// 画面遷移の世代番号。非同期処理の途中で別ページへ移ったら古い描画を捨てる
let renderGeneration = 0;
function beginRender() {
  const gen = ++renderGeneration;
  return () => gen === renderGeneration;
}
