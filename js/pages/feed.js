// 登録チャンネルの新着・高評価した動画

function renderSubscriptionsFeed() {
  const isLive = beginRender();
  setTitle('登録チャンネル');
  if (!currentUser) {
    app.innerHTML = emptyHtml('登録チャンネルの新着動画を見る',
      `<p class="sub">ログインすると、登録したチャンネルの新しい動画がここに表示されます。</p>
       <a href="#/login" class="btn btn-outline">👤 ログイン</a>`, '📥');
    return;
  }
  app.innerHTML = `<h2 class="page-title">登録チャンネルの新着</h2><div id="feed">${skeletonGrid()}</div>`;

  (async () => {
    try {
      const subs = must(await sb.from('subscriptions').select('channel_id').eq('subscriber_id', currentUser.id));
      if (!isLive()) return;
      const ids = subs.map(s => s.channel_id);
      const feed = document.getElementById('feed');
      if (!ids.length) {
        feed.innerHTML = emptyHtml('まだチャンネルを登録していません',
          '<p class="sub">気に入ったチャンネルを登録すると、新しい動画がここに届きます。</p><a href="#/" class="btn">動画を探す</a>', '📥');
        return;
      }
      mountInfiniteGrid(feed, (from, to) => sb.from('video_feed').select('*')
        .in('user_id', ids).order('created_at', { ascending: false }).range(from, to), isLive, {
        emptyHtml: emptyHtml('登録チャンネルにまだ動画がありません', '', '📥'),
      });
    } catch (err) {
      if (isLive()) app.innerHTML = errorHtml(err);
    }
  })();
}

function renderLikedFeed() {
  const isLive = beginRender();
  setTitle('高評価した動画');
  if (!currentUser) {
    app.innerHTML = emptyHtml('高評価した動画',
      `<p class="sub">ログインすると、高評価した動画をここでまとめて見られます。</p>
       <a href="#/login" class="btn btn-outline">👤 ログイン</a>`, '👍');
    return;
  }
  app.innerHTML = `<h2 class="page-title">高評価した動画</h2><div id="feed">${skeletonGrid()}</div>`;

  (async () => {
    try {
      const likes = must(await sb.from('video_likes').select('video_id').eq('user_id', currentUser.id).eq('value', 1));
      if (!isLive()) return;
      const feed = document.getElementById('feed');
      if (!likes.length) {
        feed.innerHTML = emptyHtml('高評価した動画はまだありません', '<p class="sub">動画の 👍 を押すとここに追加されます。</p>', '👍');
        return;
      }
      const ids = likes.map(l => l.video_id);
      mountInfiniteGrid(feed, (from, to) => sb.from('video_feed').select('*')
        .in('id', ids).order('created_at', { ascending: false }).range(from, to), isLive, {
        emptyHtml: emptyHtml('高評価した動画はまだありません', '', '👍'),
      });
    } catch (err) {
      if (isLive()) app.innerHTML = errorHtml(err);
    }
  })();
}
