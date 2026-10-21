// アップロード

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // Supabase 無料プランの1ファイル上限
const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
};
const EXT_TO_TYPE = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', ogg: 'video/ogg', mov: 'video/quicktime' };

// ブラウザによっては file.type が空になるので拡張子からも判定する
function detectVideoType(file) {
  if (VIDEO_TYPES[file.type]) return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  return EXT_TO_TYPE[ext] || null;
}

function drawFrame(v) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 640, 360);
  // アスペクト比を保ったまま中央に描画（縦動画は左右に黒帯）
  const scale = Math.min(640 / v.videoWidth, 360 / v.videoHeight);
  const w = v.videoWidth * scale, h = v.videoHeight * scale;
  ctx.drawImage(v, (640 - w) / 2, (360 - h) / 2, w, h);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
}

// 動画の長さと、サムネイル候補3枚（10% / 50% / 90% 地点）を取得する
function analyzeVideo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const timer = setTimeout(() => fail('動画の読み込みに時間がかかりすぎました'), 20000);
    const fail = msg => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error(msg));
    };
    const seek = t => new Promise(res => {
      v.addEventListener('seeked', res, { once: true });
      v.currentTime = t;
    });

    v.onerror = () => fail('この動画形式はブラウザで再生できません（MP4 / H.264 を推奨）');
    v.onloadeddata = async () => {
      try {
        const d = v.duration;
        if (!isFinite(d) || d <= 0 || !v.videoWidth) return fail('動画の長さを取得できませんでした');
        const thumbs = [];
        for (const ratio of [0.1, 0.5, 0.9]) {
          await seek(Math.min(d * ratio, Math.max(0, d - 0.1)));
          const blob = await drawFrame(v);
          thumbs.push({ blob, url: URL.createObjectURL(blob) });
        }
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve({ duration: d, thumbs, width: v.videoWidth, height: v.videoHeight });
      } catch (err) {
        fail(err.message);
      }
    };
    v.src = url;
  });
}

// supabase-js の upload は進捗が取れないため、Storage API に直接 XHR で送る
async function uploadWithProgress(bucket, path, file, contentType, onProgress, onXhr) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('ログインの有効期限が切れました。もう一度ログインしてください');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onXhr(xhr);
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      let msg = xhr.responseText;
      try { msg = JSON.parse(xhr.responseText).message || msg; } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error('ネットワークエラー'));
    xhr.onabort = () => reject(Object.assign(new Error('キャンセルしました'), { aborted: true }));
    xhr.send(file);
  });
}

async function fetchStorageUsed() {
  const { data, error } = await sb.rpc('my_storage_used');
  return error ? null : Number(data);
}

function renderUpload() {
  if (!requireLogin()) return;
  const isLive = beginRender();
  setTitle('動画をアップロード');

  let selected = null;
  let uploading = false;
  let currentXhr = null;
  let storageUsed = null;

  app.innerHTML = `
    <div class="upload">
      <h1>動画をアップロード</h1>
      <div class="quota" id="quota"></div>
      <label class="dropzone" id="dropzone" tabindex="0">
        <span class="big">⬆</span>
        <strong>動画ファイルをドラッグ＆ドロップ</strong>
        <span class="sub">または</span>
        <span class="btn btn-primary">ファイルを選択</span>
        <span class="sub">MP4 / WebM / MOV・1ファイル50MBまで</span>
        <input type="file" id="file-input" accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.m4v,.webm,.ogv,.mov" hidden>
      </label>
      <div class="loading" id="analyzing" hidden><div class="spinner"></div>動画を読み込んでいます...</div>

      <form id="upload-form" hidden>
        <div class="upload-grid">
          <div>
            <div class="field">
              <label for="title">タイトル（必須） <span class="hint" id="title-count">0/100</span></label>
              <input id="title" maxlength="100" required>
            </div>
            <div class="field">
              <label for="description">説明 <span class="hint" id="desc-count">0/5000</span></label>
              <textarea id="description" maxlength="5000" placeholder="視聴者に動画の内容を伝えましょう"></textarea>
            </div>
            <div class="field">
              <label>サムネイル</label>
              <div class="thumb-choices" id="thumb-choices" role="radiogroup"></div>
            </div>
          </div>
          <aside class="upload-side">
            <video id="preview-video" controls playsinline></video>
            <div class="sub" id="file-info"></div>
            <button type="button" class="btn" id="change-file">別のファイルを選ぶ</button>
          </aside>
        </div>

        <div class="progress-wrap" id="progress-wrap" hidden>
          <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>
          <span class="sub" id="progress-text">0%</span>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" id="cancel-btn">キャンセル</button>
          <button class="btn btn-primary" type="submit" id="publish-btn">公開</button>
        </div>
      </form>
    </div>`;

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const form = document.getElementById('upload-form');
  const analyzing = document.getElementById('analyzing');
  const titleEl = document.getElementById('title');
  const descEl = document.getElementById('description');
  const previewVideo = document.getElementById('preview-video');

  const renderQuota = () => {
    if (storageUsed === null) return;
    const pct = Math.min(100, storageUsed / STORAGE_QUOTA_BYTES * 100);
    document.getElementById('quota').innerHTML = `
      <div class="quota-bar"><div style="width:${pct}%" class="${pct > 90 ? 'danger' : ''}"></div></div>
      <span class="sub">保存容量 ${formatBytes(storageUsed)} / ${formatBytes(STORAGE_QUOTA_BYTES)} 使用中</span>`;
  };
  fetchStorageUsed().then(v => { if (isLive()) { storageUsed = v; renderQuota(); } });

  const updateCounts = () => {
    document.getElementById('title-count').textContent = `${titleEl.value.length}/100`;
    document.getElementById('desc-count').textContent = `${descEl.value.length}/5000`;
  };
  titleEl.addEventListener('input', updateCounts);
  descEl.addEventListener('input', updateCounts);
  autoGrow(descEl);

  // アップロード中にページを離れようとしたら警告する
  const beforeUnload = e => { if (uploading) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  const leaveGuard = () => {
    if (!isLive()) {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('hashchange', leaveGuard);
      currentXhr?.abort();
      if (selected) URL.revokeObjectURL(previewVideo.src);
    }
  };
  window.addEventListener('hashchange', leaveGuard);

  function resetToDropzone() {
    if (selected) {
      URL.revokeObjectURL(previewVideo.src);
      selected.thumbs.forEach(t => URL.revokeObjectURL(t.url));
    }
    selected = null;
    fileInput.value = '';
    form.hidden = true;
    dropzone.hidden = false;
  }

  async function handleFile(file) {
    if (!file) return;
    const type = detectVideoType(file);
    if (!type) return toast('MP4 / WebM / MOV の動画ファイルを選択してください', 'error');
    if (file.size > MAX_VIDEO_BYTES) {
      return toast(`ファイルが大きすぎます（${formatBytes(file.size)}）。50MB以下にしてください`, 'error');
    }
    if (storageUsed !== null && storageUsed + file.size > STORAGE_QUOTA_BYTES) {
      return toast('保存容量が足りません。不要な動画を削除してください', 'error');
    }

    dropzone.hidden = true;
    analyzing.hidden = false;
    let info;
    try {
      info = await analyzeVideo(file);
    } catch (err) {
      if (!isLive()) return;
      analyzing.hidden = true;
      dropzone.hidden = false;
      return toast(err.message, 'error');
    }
    if (!isLive()) return;

    selected = { file, type, duration: info.duration, thumbs: info.thumbs, thumbIndex: 0 };
    analyzing.hidden = true;
    form.hidden = false;

    previewVideo.src = URL.createObjectURL(file);
    document.getElementById('file-info').innerHTML =
      `<strong>${esc(file.name)}</strong><br>${formatBytes(file.size)}・${formatDuration(info.duration)}・${info.width}×${info.height}`;
    if (!titleEl.value) titleEl.value = file.name.replace(/\.[^.]+$/, '').slice(0, 100);
    updateCounts();

    choices.innerHTML = info.thumbs.map((t, i) => `
      <button type="button" class="thumb-choice ${i === 0 ? 'active' : ''}" data-i="${i}" role="radio" aria-checked="${i === 0}">
        <img src="${t.url}" alt="候補${i + 1}">
      </button>`).join('');
    titleEl.focus();
    titleEl.select();
  }

  const choices = document.getElementById('thumb-choices');
  choices.addEventListener('click', e => {
    const btn = e.target.closest('.thumb-choice');
    if (!btn || uploading || !selected) return;
    selected.thumbIndex = Number(btn.dataset.i);
    choices.querySelectorAll('.thumb-choice').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-checked', b === btn);
    });
  });

  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    handleFile(e.dataTransfer.files[0]);
  });
  document.getElementById('change-file').addEventListener('click', () => { if (!uploading) resetToDropzone(); });

  document.getElementById('cancel-btn').addEventListener('click', () => {
    if (uploading) {
      if (confirm('アップロードを中止しますか？')) currentXhr?.abort();
      return;
    }
    location.hash = '#/';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (uploading || !selected) return;
    const title = titleEl.value.trim();
    if (!title) return toast('タイトルを入力してください', 'error');

    const publishBtn = document.getElementById('publish-btn');
    const progressWrap = document.getElementById('progress-wrap');
    const bar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const setProgress = (p, label) => {
      bar.style.width = `${Math.round(p * 100)}%`;
      progressText.textContent = label || `${Math.round(p * 100)}%`;
    };

    uploading = true;
    publishBtn.disabled = true;
    form.classList.add('busy');
    progressWrap.hidden = false;
    setProgress(0);

    const key = uid();
    const videoPath = `${currentUser.id}/${key}.${VIDEO_TYPES[selected.type]}`;
    const thumbPath = `${currentUser.id}/${key}.jpg`;

    try {
      await uploadWithProgress('videos', videoPath, selected.file, selected.type,
        p => setProgress(p * 0.95, `アップロード中 ${Math.round(p * 100)}%`), xhr => { currentXhr = xhr; });
      currentXhr = null;
      setProgress(0.97, '仕上げ中...');

      const thumb = selected.thumbs[selected.thumbIndex].blob;
      must(await sb.storage.from('thumbnails').upload(thumbPath, thumb, { contentType: 'image/jpeg' }));

      const video = must(await sb.from('videos').insert({
        user_id: currentUser.id,
        title,
        description: descEl.value.trim(),
        video_path: videoPath,
        thumbnail_path: thumbPath,
        duration: selected.duration,
      }).select('id').single());

      setProgress(1, '完了');
      uploading = false;
      toast('動画を公開しました');
      location.hash = `#/watch/${video.id}`;
    } catch (err) {
      uploading = false;
      currentXhr = null;
      // 途中まで上がったファイルを掃除する
      await Promise.all([
        sb.storage.from('videos').remove([videoPath]),
        sb.storage.from('thumbnails').remove([thumbPath]),
      ]);
      if (!isLive()) return;
      toast(err.aborted ? 'アップロードを中止しました' : `アップロードに失敗しました：${friendlyError(err)}`, err.aborted ? '' : 'error');
      publishBtn.disabled = false;
      form.classList.remove('busy');
      progressWrap.hidden = true;
    }
  });
}
