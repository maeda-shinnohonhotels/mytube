// 再生ページ

function commentHtml(c) {
  const name = c.profiles?.display_name || '不明なユーザー';
  const mine = currentUser?.id === c.user_id;
  return `
    <div class="comment" data-id="${c.id}">
      <a href="#/channel/${esc(c.profiles?.username)}">${avatarHtml(name)}</a>
      <div class="comment-main">
        <div class="comment-head">
          <a href="#/channel/${esc(c.profiles?.username)}">@${esc(c.profiles?.username)}</a>
          <span>${timeAgo(c.created_at)}</span>
        </div>
        <div class="comment-body">${esc(c.body)}</div>
      </div>
      ${mine ? `<button class="icon-btn" data-delete-comment="${c.id}" title="削除">🗑</button>` : ''}
    </div>`;
}

async function renderWatch(id) {
  app.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: video } = await sb.from('video_feed').select('*').eq('id', id).maybeSingle();
  if (!video) {
    app.innerHTML = emptyHtml('動画が見つかりません', '<a href="#/" class="btn">ホームへ戻る</a>');
    return;
  }

  // クエリは then されるまで送信されないので、結果を待たずに発火だけさせる
  sb.rpc('increment_views', { p_video_id: id }).then(() => {});
  video.views += 1;

  const [commentsRes, relatedRes, myLikeRes, subCount, subscribed] = await Promise.all([
    sb.from('comments')
      .select('id, body, created_at, user_id, profiles(username, display_name)')
      .eq('video_id', id)
      .order('created_at', { ascending: false }),
    sb.from('video_feed').select('*').neq('id', id).order('created_at', { ascending: false }).limit(20),
    currentUser
      ? sb.from('video_likes').select('value').eq('video_id', id).eq('user_id', currentUser.id).maybeSingle()
      : Promise.resolve({ data: null }),
    getSubscriberCount(video.user_id),
    isSubscribed(video.user_id),
  ]);

  const comments = commentsRes.data || [];
  const related = relatedRes.data || [];
  let myLike = myLikeRes.data?.value || 0;
  let likeCount = Number(video.like_count);
  let commentCount = comments.length;
  const isOwner = currentUser?.id === video.user_id;

  app.innerHTML = `
    <div class="watch">
      <div>
        <video class="player" src="${publicUrl('videos', video.video_path)}" poster="${publicUrl('thumbnails', video.thumbnail_path)}" controls autoplay playsinline></video>
        <h1>${esc(video.title)}</h1>
        <div class="watch-bar">
          <div class="channel">
            <a href="#/channel/${esc(video.username)}">${avatarHtml(video.display_name, 40)}</a>
            <div>
              <a href="#/channel/${esc(video.username)}" class="channel-name">${esc(video.display_name)}</a>
              <div class="sub" id="sub-count">チャンネル登録者数 ${formatCount(subCount)}人</div>
            </div>
            ${subscribeButtonHtml(video.user_id, subscribed)}
          </div>
          <div class="actions">
            <div class="like-group">
              <button class="btn" data-like="1">👍 <span id="like-count">${formatCount(likeCount)}</span></button>
              <button class="btn" data-like="-1">👎</button>
            </div>
            <button class="btn" id="share-btn">↗ 共有</button>
            ${isOwner ? `<button class="btn btn-danger" id="delete-btn">🗑 削除</button>` : ''}
          </div>
        </div>
        <div class="desc">
          <strong>${formatCount(video.views)} 回視聴・${new Date(video.created_at).toLocaleDateString('ja-JP')}</strong>${esc(video.description) || '（説明はありません）'}
        </div>

        <section class="comments">
          <h3 id="comment-count">${commentCount} 件のコメント</h3>
          ${currentUser ? `
            <form class="comment-form" id="comment-form">
              ${avatarHtml(currentProfile?.display_name || '?')}
              <div class="comment-main">
                <textarea id="comment-text" placeholder="コメントを追加..." rows="1" maxlength="2000"></textarea>
                <div class="form-actions"><button class="btn btn-primary" type="submit">コメント</button></div>
              </div>
            </form>`
          : `<p class="sub"><a href="#/login" class="link">ログイン</a>するとコメントできます</p>`}
          <div id="comment-list">${comments.map(commentHtml).join('')}</div>
        </section>
      </div>

      <aside class="related">
        ${related.length ? related.map(v => cardHtml(v, true)).join('') : '<p class="sub">他の動画はまだありません</p>'}
      </aside>
    </div>`;

  // 高評価・低評価
  const likeBtns = app.querySelectorAll('[data-like]');
  const paintLikes = () => {
    likeBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.like) === myLike));
    document.getElementById('like-count').textContent = formatCount(likeCount);
  };
  paintLikes();
  likeBtns.forEach(btn => btn.addEventListener('click', async () => {
    if (!requireLogin()) return;
    const clicked = Number(btn.dataset.like);
    const next = myLike === clicked ? 0 : clicked;
    const { error } = next === 0
      ? await sb.from('video_likes').delete().eq('video_id', id).eq('user_id', currentUser.id)
      : await sb.from('video_likes').upsert({ video_id: id, user_id: currentUser.id, value: next });
    if (error) return toast('操作に失敗しました');
    likeCount += (next === 1 ? 1 : 0) - (myLike === 1 ? 1 : 0);
    myLike = next;
    paintLikes();
  }));

  bindSubscribeButton(video.user_id, subscribed, (_, delta) => {
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

  document.getElementById('delete-btn')?.addEventListener('click', async () => {
    if (!confirm('この動画を削除しますか？元に戻せません。')) return;
    const { error } = await sb.from('videos').delete().eq('id', id);
    if (error) return toast('削除に失敗しました');
    await Promise.all([
      sb.storage.from('videos').remove([video.video_path]),
      sb.storage.from('thumbnails').remove([video.thumbnail_path]),
    ]);
    toast('動画を削除しました');
    location.hash = `#/channel/${video.username}`;
  });

  // コメント
  const list = document.getElementById('comment-list');
  const updateCount = delta => {
    commentCount += delta;
    document.getElementById('comment-count').textContent = `${commentCount} 件のコメント`;
  };

  document.getElementById('comment-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const textEl = document.getElementById('comment-text');
    const body = textEl.value.trim();
    if (!body) return;
    const { data, error } = await sb.from('comments')
      .insert({ video_id: id, user_id: currentUser.id, body })
      .select('id, body, created_at, user_id, profiles(username, display_name)')
      .single();
    if (error) return toast('コメントを投稿できませんでした');
    list.insertAdjacentHTML('afterbegin', commentHtml(data));
    textEl.value = '';
    updateCount(1);
  });

  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-delete-comment]');
    if (!btn || !confirm('このコメントを削除しますか？')) return;
    const { error } = await sb.from('comments').delete().eq('id', btn.dataset.deleteComment);
    if (error) return toast('削除に失敗しました');
    btn.closest('.comment').remove();
    updateCount(-1);
  });
}
