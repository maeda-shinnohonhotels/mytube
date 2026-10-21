// チャンネルページ

function renderChannel(username, sort = 'new') {
  const isLive = beginRender();
  app.innerHTML = `<div class="channel-page"><div class="channel-header skeleton"><span class="sk-circle big"></span><div class="sk-lines big"><span></span><span></span></div></div>${skeletonGrid(8)}</div>`;

  (async () => {
    let profile, subCount, subscribed, stats;
    try {
      profile = must(await sb.from('profiles').select('*').eq('username', username).maybeSingle());
      if (!isLive()) return;
      if (!profile) {
        setTitle('チャンネルが見つかりません');
        app.innerHTML = emptyHtml('チャンネルが見つかりません', '<a href="#/" class="btn">ホームへ戻る</a>', '📺');
        return;
      }
      [subCount, subscribed, stats] = await Promise.all([
        getSubscriberCount(profile.id),
        isSubscribed(profile.id),
        sb.from('videos').select('views').eq('user_id', profile.id).then(must),
      ]);
    } catch (err) {
      if (isLive()) app.innerHTML = errorHtml(err);
      return;
    }
    if (!isLive()) return;

    setTitle(profile.display_name);
    const isOwner = currentUser?.id === profile.id;
    const videoCount = stats.length;
    const totalViews = stats.reduce((sum, v) => sum + Number(v.views), 0);
    const chips = [['new', '新しい順'], ['popular', '人気順'], ['old', '古い順']];

    app.innerHTML = `
      <div class="channel-page">
        <div class="channel-banner" style="--c:${avatarColor(profile.display_name)}"></div>
        <div class="channel-header">
          ${avatarHtml(profile.display_name, 120)}
          <div class="channel-info">
            <h1>${esc(profile.display_name)}</h1>
            <div class="sub">
              <strong>@${esc(profile.username)}</strong>・<span id="sub-count">チャンネル登録者数 ${formatCount(subCount)}人</span>・動画 ${videoCount} 本・総再生回数 ${formatCount(totalViews)} 回
            </div>
            <p class="channel-desc">${profile.description ? esc(profile.description) : (isOwner ? '<span class="sub">チャンネルの説明を追加しましょう</span>' : '')}</p>
            <div class="actions">
              ${subscribeButtonHtml(profile.id, subscribed)}
              ${isOwner ? `<button class="btn" id="edit-btn">✎ チャンネルを編集</button><a href="#/upload" class="btn">＋ 動画をアップロード</a>` : ''}
            </div>
          </div>
        </div>

        ${isOwner ? `
          <form class="edit-form" id="edit-form" hidden>
            <h3>チャンネルを編集</h3>
            <div class="field">
              <label for="edit-name">チャンネル名</label>
              <input id="edit-name" maxlength="50" required value="${esc(profile.display_name)}">
            </div>
            <div class="field">
              <label for="edit-desc">チャンネルの説明</label>
              <textarea id="edit-desc" maxlength="1000">${esc(profile.description)}</textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn" id="edit-cancel">キャンセル</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>` : ''}

        <div class="section-bar">
          <h2>動画</h2>
          <div class="chips">
            ${chips.map(([key, label]) => `<a href="#/channel/${esc(profile.username)}?sort=${key}" class="chip ${sort === key ? 'active' : ''}">${label}</a>`).join('')}
          </div>
        </div>
        <div id="feed"></div>
      </div>`;

    mountInfiniteGrid(document.getElementById('feed'), (from, to) => {
      let req = sb.from('video_feed').select('*').eq('user_id', profile.id);
      if (sort === 'popular') req = req.order('views', { ascending: false });
      req = req.order('created_at', { ascending: sort === 'old' });
      return req.range(from, to);
    }, isLive, {
      emptyHtml: isOwner
        ? emptyHtml('まだ動画がありません', '<p class="sub">最初の動画をアップロードしてみましょう。</p><a href="#/upload" class="btn btn-primary">＋ アップロード</a>', '🎬')
        : emptyHtml('このチャンネルにはまだ動画がありません', '', '🎬'),
    });

    bindSubscribeButton(profile.id, subscribed, delta => {
      document.getElementById('sub-count').textContent = `チャンネル登録者数 ${formatCount(subCount += delta)}人`;
    });

    if (!isOwner) return;
    const form = document.getElementById('edit-form');
    document.getElementById('edit-btn').addEventListener('click', () => {
      form.hidden = !form.hidden;
      if (!form.hidden) {
        autoGrow(document.getElementById('edit-desc'));
        document.getElementById('edit-name').focus();
      }
    });
    document.getElementById('edit-cancel').addEventListener('click', () => { form.hidden = true; });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const displayName = document.getElementById('edit-name').value.trim();
      if (!displayName) return toast('チャンネル名を入力してください', 'error');
      const { error } = await sb.from('profiles').update({
        display_name: displayName,
        description: document.getElementById('edit-desc').value.trim(),
      }).eq('id', profile.id);
      if (error) return toast(friendlyError(error), 'error');
      await loadSession();
      renderHeader();
      renderSidebar();
      toast('保存しました');
      renderChannel(username, sort);
    });
  })();
}
