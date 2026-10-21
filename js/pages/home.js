// ホーム・検索結果

async function renderHome(query = '') {
  app.innerHTML = '<div class="loading">読み込み中...</div>';

  let req = sb.from('video_feed').select('*').order('created_at', { ascending: false }).limit(60);
  if (query) {
    // PostgREST の or() 構文を壊す文字は除去する
    const q = query.replace(/[,()%*\\]/g, ' ').trim();
    if (q) req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%,display_name.ilike.%${q}%`);
  }
  const { data: videos, error } = await req;

  if (error) {
    app.innerHTML = emptyHtml('動画を読み込めませんでした', `<p class="sub">${esc(error.message)}</p>`);
    return;
  }
  if (!videos.length) {
    app.innerHTML = query
      ? emptyHtml(`「${query}」に一致する動画はありません`)
      : emptyHtml('まだ動画がありません',
          `<p>最初の動画をアップロードしてみましょう。</p><a href="#/upload" class="btn btn-primary">＋ アップロード</a>`);
    return;
  }

  app.innerHTML = `
    ${query ? `<p class="sub">「${esc(query)}」の検索結果：${videos.length} 件</p>` : ''}
    <div class="grid">${videos.map(v => cardHtml(v)).join('')}</div>`;
}
