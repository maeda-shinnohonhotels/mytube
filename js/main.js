// ルーティングと起動処理

function route() {
  window.scrollTo(0, 0);
  const hash = location.hash.slice(1) || '/';
  const [path, queryString] = hash.split('?');
  const parts = path.split('/').filter(Boolean).map(p => {
    try { return decodeURIComponent(p); } catch { return p; }
  });
  const params = new URLSearchParams(queryString);
  const sort = params.get('sort') || 'new';
  document.getElementById('search-input').value = parts[0] === 'search' ? params.get('q') || '' : '';
  updateSidebarActive();

  switch (parts[0]) {
    case 'watch': return renderWatch(parts[1]);
    case 'upload': return renderUpload();
    case 'channel': return renderChannel(parts[1], sort);
    case 'feed': return parts[1] === 'liked' ? renderLikedFeed() : renderSubscriptionsFeed();
    case 'login': beginRender(); return renderLogin('login');
    case 'signup': beginRender(); return renderLogin('signup');
    case 'search': return renderHome(params.get('q') || '', sort);
    default: return renderHome('', sort);
  }
}

document.getElementById('search-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('search-input');
  const q = input.value.trim();
  input.blur();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/';
});

// 「/」キーで検索欄へ
document.addEventListener('keydown', e => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  e.preventDefault();
  document.getElementById('search-input').focus();
});

window.addEventListener('hashchange', route);

(async () => {
  try {
    await loadSession();
  } catch (err) {
    console.error(err);
  }
  renderHeader();
  renderSidebar();
  route();

  // 別タブでのログイン・ログアウトや、メール確認リンクからの復帰を反映する
  // （コールバック内で Supabase を await するとデッドロックするため setTimeout で逃がす）
  sb.auth.onAuthStateChange(event => {
    if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
    setTimeout(async () => {
      const prevId = currentUser?.id;
      await loadSession();
      if (prevId === currentUser?.id) return;
      renderHeader();
      renderSidebar();
      route();
    }, 0);
  });
})();
