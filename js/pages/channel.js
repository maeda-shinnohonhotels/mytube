// チャンネルページ

async function renderChannel(username) {
  app.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: profile } = await sb.from('profiles').select('*').eq('username', username).maybeSingle();
  if (!profile) {
    app.innerHTML = emptyHtml('チャンネルが見つかりません', '<a href="#/" class="btn">ホームへ戻る</a>');
    return;
  }

  const [videosRes, subCount, subscribed] = await Promise.all([
    sb.from('video_feed').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
    getSubscriberCount(profile.id),
    isSubscribed(profile.id),
  ]);
  const videos = videosRes.data || [];
  const isOwner = currentUser?.id === profile.id;
  let subs = subCount;

  app.innerHTML = `
    <div class="channel-page">
      <div class="channel-header">
        ${avatarHtml(profile.display_name, 120)}
        <div class="channel-info">
          <h1>${esc(profile.display_name)}</h1>
          <div class="sub">@${esc(profile.username)}・<span id="sub-count">チャンネル登録者数 ${formatCount(subs)}人</span>・動画 ${videos.length} 本</div>
          ${profile.description ? `<p class="channel-desc">${esc(profile.description)}</p>` : ''}
          <div class="actions">
            ${subscribeButtonHtml(profile.id, subscribed)}
            ${isOwner ? `<button class="btn" id="edit-btn">✎ チャンネルを編集</button><a href="#/upload" class="btn">＋ 動画をアップロード</a>` : ''}
          </div>
        </div>
      </div>

      ${isOwner ? `
        <form class="edit-form" id="edit-form" hidden>
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

      <h2 class="section-title">動画</h2>
      ${videos.length
        ? `<div class="grid">${videos.map(v => cardHtml(v)).join('')}</div>`
        : `<p class="sub">まだ動画がありません</p>`}
    </div>`;

  bindSubscribeButton(profile.id, subscribed, (_, delta) => {
    document.getElementById('sub-count').textContent = `チャンネル登録者数 ${formatCount(subs += delta)}人`;
  });

  if (!isOwner) return;
  const form = document.getElementById('edit-form');
  document.getElementById('edit-btn').addEventListener('click', () => { form.hidden = !form.hidden; });
  document.getElementById('edit-cancel').addEventListener('click', () => { form.hidden = true; });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await sb.from('profiles').update({
      display_name: document.getElementById('edit-name').value.trim(),
      description: document.getElementById('edit-desc').value.trim(),
    }).eq('id', profile.id);
    if (error) return toast('保存に失敗しました');
    await loadSession();
    renderHeader();
    toast('保存しました');
    renderChannel(username);
  });
}
