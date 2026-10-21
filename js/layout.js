// サイドバー

const sidebar = document.getElementById('sidebar');

async function renderSidebar() {
  const item = (href, icon, label) =>
    `<a href="${href}" class="side-item"><span class="side-icon">${icon}</span>${label}</a>`;

  let html = `
    ${item('#/', '🏠', 'ホーム')}
    ${item('#/feed/subscriptions', '📥', '登録チャンネル')}
    <hr>
    ${currentProfile ? item(`#/channel/${esc(currentProfile.username)}`, '📺', 'マイチャンネル') : ''}
    ${item('#/feed/liked', '👍', '高評価した動画')}
    ${currentUser ? item('#/upload', '⬆', 'アップロード') : ''}`;

  if (!currentUser) {
    html += `<hr><div class="side-note">ログインすると、高評価やコメント、チャンネル登録ができます。<a href="#/login" class="btn btn-outline">👤 ログイン</a></div>`;
    sidebar.innerHTML = html;
    updateSidebarActive();
    return;
  }

  sidebar.innerHTML = html;
  updateSidebarActive();
  const { data } = await sb.from('subscriptions')
    .select('channel:profiles!subscriptions_channel_id_fkey(username, display_name)')
    .eq('subscriber_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(30);
  const channels = (data || []).map(r => r.channel).filter(Boolean);
  if (channels.length) {
    sidebar.insertAdjacentHTML('beforeend', `
      <hr><h4 class="side-heading">登録チャンネル</h4>
      ${channels.map(c => `
        <a href="#/channel/${esc(c.username)}" class="side-item">
          ${avatarHtml(c.display_name, 24)}<span class="ellipsis">${esc(c.display_name)}</span>
        </a>`).join('')}`);
    updateSidebarActive();
  }
}

// クエリ（?sort= など）を除いたパスで現在地を判定する
function updateSidebarActive() {
  const path = (location.hash || '#/').split('?')[0];
  sidebar.querySelectorAll('.side-item').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === path);
  });
}

function closeSidebarOnMobile() {
  document.body.classList.remove('sidebar-open');
}

document.getElementById('menu-toggle').addEventListener('click', () => {
  if (window.matchMedia('(max-width: 1100px)').matches) {
    document.body.classList.toggle('sidebar-open');
  } else {
    document.body.classList.toggle('sidebar-collapsed');
  }
});
document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebarOnMobile);
sidebar.addEventListener('click', e => { if (e.target.closest('a')) closeSidebarOnMobile(); });
