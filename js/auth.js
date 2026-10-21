// ログイン・新規登録・ヘッダー表示

function renderHeader() {
  const el = document.getElementById('top-actions');
  if (!currentUser) {
    el.innerHTML = `<a href="#/login" class="btn btn-outline">👤 ログイン</a>`;
    return;
  }
  const name = currentProfile?.display_name || currentUser.email;
  el.innerHTML = `
    <a href="#/upload" class="btn btn-primary">＋ アップロード</a>
    <div class="menu-wrap">
      <button class="avatar-btn" id="avatar-btn" title="${esc(name)}">${avatarHtml(name, 34)}</button>
      <div class="menu" id="user-menu" hidden>
        <div class="menu-head">
          <strong>${esc(name)}</strong>
          ${currentProfile ? `<span class="sub">@${esc(currentProfile.username)}</span>` : ''}
        </div>
        ${currentProfile ? `<a href="#/channel/${esc(currentProfile.username)}">マイチャンネル</a>` : ''}
        <button id="logout-btn">ログアウト</button>
      </div>
    </div>`;

  const menu = document.getElementById('user-menu');
  document.getElementById('avatar-btn').addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  menu.addEventListener('click', () => { menu.hidden = true; });
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await sb.auth.signOut();
    toast('ログアウトしました');
    location.hash = '#/';
  });
}

document.addEventListener('click', () => {
  const menu = document.getElementById('user-menu');
  if (menu) menu.hidden = true;
});

function renderLogin(mode = 'login') {
  if (currentUser) {
    location.hash = '#/';
    return;
  }
  const isSignup = mode === 'signup';
  app.innerHTML = `
    <div class="auth-box">
      <h1>${isSignup ? 'アカウント作成' : 'ログイン'}</h1>
      <form id="auth-form">
        ${isSignup ? `
          <div class="field">
            <label for="username">ユーザーID（半角英数字と _、3〜20文字。チャンネルURLになります）</label>
            <input id="username" required pattern="[A-Za-z0-9_]{3,20}" autocomplete="username">
          </div>
          <div class="field">
            <label for="display-name">チャンネル名（表示名）</label>
            <input id="display-name" required maxlength="50">
          </div>` : ''}
        <div class="field">
          <label for="email">メールアドレス</label>
          <input id="email" type="email" required autocomplete="email">
        </div>
        <div class="field">
          <label for="password">パスワード（6文字以上）</label>
          <input id="password" type="password" required minlength="6" autocomplete="${isSignup ? 'new-password' : 'current-password'}">
        </div>
        <p class="error" id="auth-error" hidden></p>
        <button class="btn btn-primary btn-block" type="submit">${isSignup ? '登録する' : 'ログイン'}</button>
      </form>
      <p class="sub auth-switch">
        ${isSignup
          ? 'アカウントをお持ちの方は <a href="#/login">ログイン</a>'
          : 'はじめての方は <a href="#/signup">アカウント作成</a>'}
      </p>
    </div>`;

  const form = document.getElementById('auth-form');
  const errorEl = document.getElementById('auth-error');
  const showError = msg => { errorEl.textContent = msg; errorEl.hidden = false; };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.hidden = true;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      if (!isSignup) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return showError('メールアドレスまたはパスワードが違います');
        toast('ログインしました');
        location.hash = '#/';
        return;
      }

      const username = document.getElementById('username').value.trim();
      const displayName = document.getElementById('display-name').value.trim();
      const { data: taken } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
      if (taken) return showError('このユーザーIDはすでに使われています');

      const options = { data: { username, display_name: displayName } };
      if (location.protocol.startsWith('http')) options.emailRedirectTo = location.origin + location.pathname;
      const { data, error } = await sb.auth.signUp({ email, password, options });
      if (error) return showError(`登録に失敗しました：${error.message}`);

      if (!data.session) {
        app.innerHTML = emptyHtml('確認メールを送信しました',
          `<p>${esc(email)} に届いたメールのリンクを開くと登録が完了します。<br>その後ログインしてください。</p>
           <a href="#/login" class="btn">ログイン画面へ</a>`);
        return;
      }
      toast('アカウントを作成しました');
      location.hash = '#/';
    } finally {
      submitBtn.disabled = false;
    }
  });
}
