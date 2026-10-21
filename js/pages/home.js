// ホーム・検索結果（無限スクロール）

const PAGE_SIZE = 24;

// 動画一覧を無限スクロールで描画する。fetchPage(from, to) は Supabase クエリを返す
function mountInfiniteGrid(container, fetchPage, isLive, { emptyHtml: emptyMarkup, compact = false } = {}) {
  let offset = 0;
  let done = false;
  let loading = false;

  container.innerHTML = `<div class="grid"></div><div class="sentinel"></div>`;
  const sentinel = container.querySelector('.sentinel');

  // 読み込み後も画面内に sentinel が見えたままだと IntersectionObserver が再発火しないので自前で確認する
  const fillViewport = () => {
    if (!done && isLive() && sentinel.isConnected && sentinel.getBoundingClientRect().top < innerHeight + 600) loadMore();
  };

  async function loadMore() {
    if (loading || done) return;
    loading = true;
    sentinel.innerHTML = offset ? '<div class="spinner"></div>' : '';
    if (!offset) container.querySelector('.grid').outerHTML = skeletonGrid();
    try {
      const videos = must(await fetchPage(offset, offset + PAGE_SIZE - 1));
      if (!isLive()) return;
      if (!offset) container.querySelector('.grid').outerHTML = '<div class="grid"></div>';
      const g = container.querySelector('.grid');
      if (!offset && !videos.length) {
        container.innerHTML = emptyMarkup;
        done = true;
        return;
      }
      g.insertAdjacentHTML('beforeend', videos.map(v => cardHtml(v, compact)).join(''));
      offset += videos.length;
      done = videos.length < PAGE_SIZE;
      sentinel.innerHTML = '';
      setTimeout(fillViewport, 0);
    } catch (err) {
      if (!isLive()) return;
      if (!offset) container.innerHTML = errorHtml(err);
      else sentinel.innerHTML = `<button class="btn">もっと見る</button>`;
      sentinel.querySelector('button')?.addEventListener('click', loadMore);
    } finally {
      loading = false;
    }
  }

  const observer = new IntersectionObserver(entries => {
    if (!isLive()) return observer.disconnect();
    if (entries[0].isIntersecting) loadMore();
  }, { rootMargin: '600px' });
  observer.observe(sentinel);
  loadMore();
}

function renderHome(query = '', sort = 'new') {
  const isLive = beginRender();
  setTitle(query ? `${query} の検索結果` : '');

  const chips = [['new', '新着'], ['popular', '人気']];
  const base = query ? `#/search?q=${encodeURIComponent(query)}&sort=` : '#/?sort=';
  app.innerHTML = `
    ${query ? `<h2 class="page-title">「${esc(query)}」の検索結果</h2>` : ''}
    <div class="chips">
      ${chips.map(([key, label]) => `<a href="${base}${key}" class="chip ${sort === key ? 'active' : ''}">${label}</a>`).join('')}
    </div>
    <div id="feed"></div>`;

  // PostgREST の or() 構文を壊す文字は除去する
  const q = query.replace(/[,()%*\\:."]/g, ' ').trim();

  mountInfiniteGrid(document.getElementById('feed'), (from, to) => {
    let req = sb.from('video_feed').select('*');
    if (q) req = req.or(`title.ilike.%${q}%,description.ilike.%${q}%,display_name.ilike.%${q}%`);
    req = sort === 'popular'
      ? req.order('views', { ascending: false }).order('created_at', { ascending: false })
      : req.order('created_at', { ascending: false });
    return req.range(from, to);
  }, isLive, {
    emptyHtml: query
      ? emptyHtml(`「${query}」に一致する動画はありません`, '<p class="sub">別のキーワードで検索してみてください。</p>', '🔍')
      : emptyHtml('まだ動画がありません',
          `<p>最初の動画をアップロードしてみましょう。</p><a href="#/upload" class="btn btn-primary">＋ アップロード</a>`, '🎬'),
  });
}
