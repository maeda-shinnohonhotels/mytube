// ログイン・新規登録・ヘッダー表示

function renderHeader() {
  const el = document.getElementById('top-actions');
  if (!currentUser) {
    el.innerHTML = `<a href="#/login" class="btn btn-outline">👤 ログイン</a>`;
    return;
  }
  const name = currentProfile?.display_name || currentUser.email;
  el.innerHTML = `
    <a href="#/upload" class="btn btn-primary upload-btn" title="アップロード">＋<span class="label"> アップロード</span></a>
    <div class="menu-wrap">
      <button class="avatar-btn" id="avatar-btn" aria-haspopup="menu" aria-expanded="false" title="${esc(name)}">${avatarHtml(name, 34)}</button>
      <div class="menu" id="user-menu" role="menu" hidden>
        <div class="menu-head">
          <strong>${esc(name)}</strong>
          ${currentProfile ? `<span class="sub">@${esc(currentProfile.username)}</span>` : ''}
          <span class="sub">${esc(currentUser.email)}</span>
        </div>
        ${currentProfile ? `<a href="#/channel/${esc(currentProfile.username)}" role="menuitem">📺 マイチャンネル</a>` : ''}
        <a href="#/feed/liked" role="menuitem">👍 高評価した動画</a>
        <button id="logout-btn" role="menuitem">↩ ログアウト</button>
      </div>
    </div>`;

  const menu = document.getElementById('user-menu');
  const avatarBtn = document.getElementById('avatar-btn');
  avatarBtn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    avatarBtn.setAttribute('aria-expanded', !menu.hidden);
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

function goAfterLogin() {
  const next = sessionStorage.getItem('mytube:after-login');
  sessionStorage.removeItem('mytube:after-login');
  location.hash = next && !/^#\/(login|signup)/.test(next) ? next : '#/';
}

function renderLogin(mode = 'login') {
  if (currentUser) return goAfterLogin();
  const isSignup = mode === 'signup';
  setTitle(isSignup ? 'アカウント作成' : 'ログイン');

  app.innerHTML = `
    <div class="auth-box">
      <div class="auth-logo"><span class="logo-icon">▶</span></div>
      <h1>${isSignup ? 'アカウント作成' : 'ログイン'}</h1>
      <p class="sub center">${isSignup ? 'チャンネルを作って動画を投稿しましょう' : 'MyTube を続けるにはログインしてください'}</p>
      <form id="auth-form" novalidate>
        ${isSignup ? `
          <div class="field">
            <label for="display-name">チャンネル名</label>
            <input id="display-name" required maxlength="50" autocomplete="nickname">
          </div>
          <div class="field">
            <label for="username">ユーザーID <span class="hint">半角英数字と _ で3〜20文字。チャンネルのURLになります</span></label>
            <div class="input-prefix"><span>@</span><input id="username" required maxlength="20" autocomplete="username" spellcheck="false"></div>
            <p class="field-msg" id="username-msg"></p>
          </div>` : ''}
        <div class="field">
          <label for="email">メールアドレス</label>
          <input id="email" type="email" required autocomplete="email">
        </div>
        <div class="field">
          <label for="password">パスワード ${isSignup ? '<span class="hint">6文字以上</span>' : ''}</label>
          <div class="input-suffix">
            <input id="password" type="password" required minlength="6" autocomplete="${isSignup ? 'new-password' : 'current-password'}">
            <button type="button" class="icon-btn" id="toggle-pw" aria-label="パスワードを表示">👁</button>
          </div>
        </div>
        <p class="error" id="auth-error" role="alert" hidden></p>
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
  const pw = document.getElementById('password');

  document.getElementById('toggle-pw').addEventListener('click', () => {
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });
  form.querySelector('input').focus();

  // ユーザーIDの形式と空き状況をその場でチェック
  let usernameOk = false;
  if (isSignup) {
    const input = document.getElementById('username');
    const msg = document.getElementById('username-msg');
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      usernameOk = false;
      const v = input.value.trim();
      msg.className = 'field-msg';
      if (!v) { msg.textContent = ''; return; }
      if (!/^[A-Za-z0-9_]{3,20}$/.test(v)) {
        msg.textContent = '半角英数字と _ で3〜20文字にしてください';
        msg.classList.add('ng');
        return;
      }
      msg.textContent = '確認中...';
      timer = setTimeout(async () => {
        const { data, error } = await sb.from('profiles').select('id').eq('username', v).maybeSingle();
        if (input.value.trim() !== v) return;
        if (error) { msg.textContent = ''; return; }
        usernameOk = !data;
        msg.textContent = data ? 'このユーザーIDはすでに使われています' : '✓ 使用できます';
        msg.classList.add(data ? 'ng' : 'ok');
      }, 400);
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = document.getElementById('email').value.trim();
    const password = pw.value;

    if (!email || !password) return showError('メールアドレスとパスワードを入力してください');
    if (isSignup) {
      if (!document.getElementById('display-name').value.trim()) return showError('チャンネル名を入力してください');
      if (!usernameOk) return showError('ユーザーIDを確認してください');
      if (password.length < 6) return showError('パスワードは6文字以上にしてください');
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      if (!isSignup) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return showError(friendlyError(error));
        await loadSession();
        renderHeader();
        renderSidebar();
        toast('ログインしました');
        return goAfterLogin();
      }

      const username = document.getElementById('username').value.trim();
      const displayName = document.getElementById('display-name').value.trim();
      const options = { data: { username, display_name: displayName } };
      if (location.protocol.startsWith('http')) options.emailRedirectTo = location.origin + location.pathname;
      const { data, error } = await sb.auth.signUp({ email, password, options });
      if (error) return showError(friendlyError(error));

      if (!data.session) {
        app.innerHTML = emptyHtml('確認メールを送信しました',
          `<p>${esc(email)} に届いたメールのリンクを開くと登録が完了します。<br>その後ログインしてください。</p>
           <a href="#/login" class="btn">ログイン画面へ</a>`, '✉');
        return;
      }
      await loadSession();
      renderHeader();
      renderSidebar();
      toast('アカウントを作成しました');
      goAfterLogin();
    } catch (err) {
      showError(friendlyError(err));
    } finally {
      submitBtn.disabled = false;
    }
  });
}
