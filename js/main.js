// ルーティングと起動処理

function route() {
  window.scrollTo(0, 0);
  const hash = location.hash.slice(1) || '/';
  const [path, queryString] = hash.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(queryString);
  const searchInput = document.getElementById('search-input');
  searchInput.value = parts[0] === 'search' ? params.get('q') || '' : '';

  switch (parts[0]) {
    case 'watch': return renderWatch(parts[1]);
    case 'upload': return renderUpload();
    case 'channel': return renderChannel(parts[1]);
    case 'login': return renderLogin('login');
    case 'signup': return renderLogin('signup');
    case 'search': return renderHome(params.get('q') || '');
    default: return renderHome();
  }
}

document.getElementById('search-form').addEventListener('submit', e => {
  e.preventDefault();
  const q = document.getElementById('search-input').value.trim();
  location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/';
});

window.addEventListener('hashchange', route);

(async () => {
  await loadSession();
  renderHeader();
  route();

  // ログイン・ログアウトを検知して画面を更新する
  // （コールバック内で Supabase を await するとデッドロックするため setTimeout で逃がす）
  sb.auth.onAuthStateChange(event => {
    if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
    setTimeout(async () => {
      const prevId = currentUser?.id;
      await loadSession();
      renderHeader();
      if (prevId !== currentUser?.id) route();
    }, 0);
  });
})();
