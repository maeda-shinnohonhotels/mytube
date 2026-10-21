// 再生ページ

const COMMENT_SELECT = 'id, body, created_at, user_id, profiles(username, display_name)';

function commentHtml(c) {
  const name = c.profiles?.display_name || '不明なユーザー';
  const username = c.profiles?.username || '';
  const mine = currentUser?.id === c.user_id;
  return `
    <div class="comment" data-id="${esc(c.id)}">
      <a href="#/channel/${esc(username)}">${avatarHtml(name)}</a>
      <div class="comment-main">
        <div class="comment-head">
          <a href="#/channel/${esc(username)}">@${esc(username)}</a>
          <span title="${esc(new Date(c.created_at).toLocaleString('ja-JP'))}">${timeAgo(c.created_at)}</span>
        </div>
        <div class="comment-body">${esc(c.body)}</div>
      </div>
      ${mine ? `<button class="icon-btn" data-delete-comment="${esc(c.id)}" title="削除" aria-label="コメントを削除">🗑</button>` : ''}
    </div>`;
}

function watchSkeleton() {
  return `
    <div class="watch skeleton">
      <div>
        <div class="player"></div>
        <div class="sk-lines big"><span></span><span></span></div>
      </div>
      <aside>${Array.from({ length: 6 }, () => '<div class="sk-related"><div class="thumb"></div><div class="sk-lines"><span></span><span></span></div></div>').join('')}</aside>
    </div>`;
}

async function renderWatch(id) {
  const isLive = beginRender();
  app.innerHTML = watchSkeleton();

  let video, comments, related, myLike, subCount, subscribed;
  try {
    // UUID でない ID は DB に問い合わせるとエラーになるので、見つからない扱いにする
    const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
    video = validId ? must(await sb.from('video_feed').select('*').eq('id', id).maybeSingle()) : null;
    if (!isLive()) return;
    if (!video) {
      setTitle('動画が見つかりません');
      app.innerHTML = emptyHtml('動画が見つかりません', '<p class="sub">削除されたか、URLが間違っている可能性があります。</p><a href="#/" class="btn">ホームへ戻る</a>', '🎬');
      return;
    }

    // 結果は待たずに送信だけする（クエリは then されるまで送られない）
    sb.rpc('increment_views', { p_video_id: id }).then(() => {});

    [comments, related, myLike, subCount, subscribed] = await Promise.all([
      sb.from('comments').select(COMMENT_SELECT).eq('video_id', id).order('created_at', { ascending: false }).limit(200).then(must),
      sb.from('video_feed').select('*').neq('id', id).order('created_at', { ascending: false }).limit(20).then(must),
      currentUser
        ? sb.from('video_likes').select('value').eq('video_id', id).eq('user_id', currentUser.id).maybeSingle().then(must)
        : null,
      getSubscriberCount(video.user_id),
      isSubscribed(video.user_id),
    ]);
  } catch (err) {
    if (isLive()) app.innerHTML = errorHtml(err);
    return;
  }
  if (!isLive()) return;

  setTitle(video.title);
  myLike = myLike?.value || 0;
  let likeCount = Number(video.like_count);
  let commentCount = Number(video.comment_count);
  const isOwner = currentUser?.id === video.user_id;
  const posted = new Date(video.created_at);

  app.innerHTML = `
    <div class="watch">
      <div class="watch-main">
        <video class="player" src="${esc(publicUrl('videos', video.video_path))}" poster="${esc(publicUrl('thumbnails', video.thumbnail_path))}" controls autoplay playsinline></video>
        <h1 id="video-title">${esc(video.title)}</h1>
        <div class="watch-bar">
          <div class="channel">
            <a href="#/channel/${esc(video.username)}">${avatarHtml(video.display_name, 40)}</a>
            <div class="channel-text">
              <a href="#/channel/${esc(video.username)}" class="channel-name">${esc(video.display_name)}</a>
              <div class="sub" id="sub-count">チャンネル登録者数 ${formatCount(subCount)}人</div>
            </div>
            ${subscribeButtonHtml(video.user_id, subscribed)}
          </div>
          <div class="actions">
            <div class="like-group" role="group" aria-label="評価">
              <button class="btn" data-like="1" aria-label="高評価">👍 <span id="like-count">${formatCount(likeCount)}</span></button>
              <button class="btn" data-like="-1" aria-label="低評価">👎</button>
            </div>
            <button class="btn" id="share-btn">↗ 共有</button>
            ${isOwner ? `
              <button class="btn" id="edit-btn">✎ 編集</button>
              <button class="btn btn-danger" id="delete-btn">🗑 削除</button>` : ''}
          </div>
        </div>

        <div class="desc collapsed" id="desc">
          <strong>${formatCount(video.views + 1)} 回視聴・<span title="${esc(posted.toLocaleString('ja-JP'))}">${posted.toLocaleDateString('ja-JP')}</span></strong>
          <div class="desc-body" id="desc-body">${esc(video.description) || '<span class="sub">（説明はありません）</span>'}</div>
          <button class="desc-toggle" id="desc-toggle" hidden>もっと見る</button>
        </div>

        ${isOwner ? `
          <form class="edit-form" id="video-edit-form" hidden>
            <h3>動画の情報を編集</h3>
            <div class="field">
              <label for="edit-title">タイトル</label>
              <input id="edit-title" maxlength="100" required value="${esc(video.title)}">
            </div>
            <div class="field">
              <label for="edit-description">説明</label>
              <textarea id="edit-description" maxlength="5000">${esc(video.description)}</textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn" id="edit-cancel">キャンセル</button>
              <button type="submit" class="btn btn-primary">保存</button>
            </div>
          </form>` : ''}

        <section class="comments">
          <h3 id="comment-count">${formatCount(commentCount)} 件のコメント</h3>
          ${currentUser ? `
            <form class="comment-form" id="comment-form">
              ${avatarHtml(currentProfile?.display_name || '?')}
              <div class="comment-main">
                <textarea id="comment-text" placeholder="コメントを追加..." rows="1" maxlength="2000" aria-label="コメント"></textarea>
                <div class="form-actions" id="comment-actions" hidden>
                  <span class="sub">Ctrl + Enter で送信</span>
                  <button class="btn" type="button" id="comment-cancel">キャンセル</button>
                  <button class="btn btn-primary" type="submit" id="comment-submit" disabled>コメント</button>
                </div>
              </div>
            </form>`
          : `<p class="sub"><a href="#/login" class="link" onclick="sessionStorage.setItem('mytube:after-login', location.hash)">ログイン</a>するとコメントできます</p>`}
          <div id="comment-list">${comments.map(commentHtml).join('')}</div>
        </section>
      </div>

      <aside class="related">
        <h3 class="related-title">次の動画</h3>
        ${related.length ? related.map(v => cardHtml(v, true)).join('') : '<p class="sub">他の動画はまだありません</p>'}
      </aside>
    </div>`;

  const player = app.querySelector('.player');
  player.addEventListener('error', () => toast('この動画はお使いのブラウザで再生できない形式です', 'error'));

  // 説明欄：長いときだけ折りたたむ
  const desc = document.getElementById('desc');
  const descBody = document.getElementById('desc-body');
  const descToggle = document.getElementById('desc-toggle');
  if (descBody.scrollHeight > descBody.clientHeight + 4) descToggle.hidden = false;
  else desc.classList.remove('collapsed');
  descToggle.addEventListener('click', () => {
    const collapsed = desc.classList.toggle('collapsed');
    descToggle.textContent = collapsed ? 'もっと見る' : '一部を表示';
  });

  // 高評価・低評価
  const likeBtns = app.querySelectorAll('[data-like]');
  const paintLikes = () => {
    likeBtns.forEach(b => {
      const on = Number(b.dataset.like) === myLike;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
    document.getElementById('like-count').textContent = formatCount(likeCount);
  };
  paintLikes();
  let liking = false;
  likeBtns.forEach(btn => btn.addEventListener('click', async () => {
    if (!requireLogin() || liking) return;
    liking = true;
    const clicked = Number(btn.dataset.like);
    const prev = myLike;
    const next = prev === clicked ? 0 : clicked;
    // 先に画面へ反映し、失敗したら戻す
    myLike = next;
    likeCount += (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0);
    paintLikes();
    const { error } = next === 0
      ? await sb.from('video_likes').delete().eq('video_id', id).eq('user_id', currentUser.id)
      : await sb.from('video_likes').upsert({ video_id: id, user_id: currentUser.id, value: next });
    liking = false;
    if (error) {
      myLike = prev;
      likeCount -= (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0);
      paintLikes();
      toast(friendlyError(error), 'error');
    } else if (next === 1) {
      toast('高評価した動画に追加しました');
    }
  }));

  bindSubscribeButton(video.user_id, subscribed, delta => {
    document.getElementById('sub-count').textContent = `チャンネル登録者数 ${formatCount(subCount += delta)}人`;
  });

  document.getElementById('share-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('リンクをコピーしました');
    } catch {
      prompt('このURLをコピーしてください', location.href);
    }
  });

  // 編集・削除（投稿者のみ）
  if (isOwner) {
    const editForm = document.getElementById('video-edit-form');
    document.getElementById('edit-btn').addEventListener('click', () => {
      editForm.hidden = !editForm.hidden;
      if (!editForm.hidden) {
        autoGrow(document.getElementById('edit-description'));
        document.getElementById('edit-title').focus();
      }
    });
    document.getElementById('edit-cancel').addEventListener('click', () => { editForm.hidden = true; });
    editForm.addEventListener('submit', async e => {
      e.preventDefault();
      const title = document.getElementById('edit-title').value.trim();
      const description = document.getElementById('edit-description').value.trim();
      if (!title) return toast('タイトルを入力してください', 'error');
      const { error } = await sb.from('videos').update({ title, description }).eq('id', id);
      if (error) return toast(friendlyError(error), 'error');
      video.title = title;
      video.description = description;
      document.getElementById('video-title').textContent = title;
      descBody.innerHTML = esc(description) || '<span class="sub">（説明はありません）</span>';
      setTitle(title);
      editForm.hidden = true;
      toast('保存しました');
    });

    document.getElementById('delete-btn').addEventListener('click', async () => {
      if (!confirm(`「${video.title}」を削除しますか？\nコメントや高評価も削除され、元に戻せません。`)) return;
      const { error } = await sb.from('videos').delete().eq('id', id);
      if (error) return toast(friendlyError(error), 'error');
      await Promise.all([
        sb.storage.from('videos').remove([video.video_path]),
        sb.storage.from('thumbnails').remove([video.thumbnail_path]),
      ]);
      toast('動画を削除しました');
      location.hash = `#/channel/${video.username}`;
    });
  }

  // コメント
  const list = document.getElementById('comment-list');
  const updateCount = delta => {
    commentCount += delta;
    document.getElementById('comment-count').textContent = `${formatCount(commentCount)} 件のコメント`;
  };

  const commentForm = document.getElementById('comment-form');
  if (commentForm) {
    const textEl = document.getElementById('comment-text');
    const actions = document.getElementById('comment-actions');
    const submitBtn = document.getElementById('comment-submit');
    autoGrow(textEl);
    textEl.addEventListener('focus', () => { actions.hidden = false; });
    textEl.addEventListener('input', () => { submitBtn.disabled = !textEl.value.trim(); });
    textEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commentForm.requestSubmit();
    });
    document.getElementById('comment-cancel').addEventListener('click', () => {
      textEl.value = '';
      textEl.style.height = 'auto';
      submitBtn.disabled = true;
      actions.hidden = true;
    });

    commentForm.addEventListener('submit', async e => {
      e.preventDefault();
      const body = textEl.value.trim();
      if (!body || submitBtn.disabled) return;
      submitBtn.disabled = true;
      const { data, error } = await sb.from('comments')
        .insert({ video_id: id, user_id: currentUser.id, body })
        .select(COMMENT_SELECT)
        .single();
      if (error) {
        submitBtn.disabled = false;
        return toast(friendlyError(error), 'error');
      }
      list.insertAdjacentHTML('afterbegin', commentHtml(data));
      textEl.value = '';
      textEl.style.height = 'auto';
      actions.hidden = true;
      updateCount(1);
    });
  }

  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-delete-comment]');
    if (!btn || !confirm('このコメントを削除しますか？')) return;
    const { error } = await sb.from('comments').delete().eq('id', btn.dataset.deleteComment);
    if (error) return toast(friendlyError(error), 'error');
    btn.closest('.comment').remove();
    updateCount(-1);
  });
}
