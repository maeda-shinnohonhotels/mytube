// アップロード

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // Supabase 無料プランの上限
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

function captureThumbnail(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(1, (v.duration || 0) * 0.1);
    };
    v.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 640, 360);
      // アスペクト比を保ったまま中央に描画
      const scale = Math.min(640 / v.videoWidth, 360 / v.videoHeight);
      const w = v.videoWidth * scale, h = v.videoHeight * scale;
      ctx.drawImage(v, (640 - w) / 2, (360 - h) / 2, w, h);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        resolve({ thumbBlob: blob, thumbUrl: URL.createObjectURL(blob), duration: v.duration });
      }, 'image/jpeg', 0.8);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('この動画形式はブラウザで再生できません（MP4 / WebM を推奨）'));
    };
  });
}

// supabase-js の upload は進捗が取れないため、Storage API に直接 XHR で送る
async function uploadWithProgress(bucket, path, file, onProgress) {
  const { data: { session } } = await sb.auth.getSession();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', SUPABASE_KEY);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)));
    xhr.onerror = () => reject(new Error('ネットワークエラー'));
    xhr.send(file);
  });
}

function renderUpload() {
  if (!requireLogin()) return;
  let selected = null;

  app.innerHTML = `
    <div class="upload">
      <h1>動画をアップロード</h1>
      <label class="dropzone" id="dropzone">
        <span class="big">⬆</span>
        <span>ここに動画ファイルをドラッグ＆ドロップ<br>またはクリックして選択</span>
        <span class="sub">MP4 / WebM 推奨・1ファイル50MBまで</span>
        <input type="file" id="file-input" accept="video/mp4,video/webm,video/ogg,video/quicktime" hidden>
      </label>
      <form id="upload-form" hidden>
        <div class="preview">
          <img id="thumb-preview" alt="サムネイル">
          <div class="sub" id="file-info"></div>
        </div>
        <div class="field">
          <label for="title">タイトル（必須）</label>
          <input id="title" maxlength="100" required>
        </div>
        <div class="field">
          <label for="description">説明</label>
          <textarea id="description" maxlength="5000"></textarea>
        </div>
        <div class="progress" id="progress" hidden><div class="progress-bar" id="progress-bar"></div></div>
        <div class="form-actions">
          <a href="#/" class="btn">キャンセル</a>
          <button class="btn btn-primary" type="submit" id="publish-btn">公開</button>
        </div>
      </form>
    </div>`;

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const form = document.getElementById('upload-form');

  async function handleFile(file) {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return toast('MP4 / WebM などの動画ファイルを選択してください');
    if (file.size > MAX_VIDEO_BYTES) {
      return toast(`ファイルが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。50MB以下にしてください`);
    }
    try {
      selected = { file, ...(await captureThumbnail(file)) };
    } catch (err) {
      return toast(err.message);
    }
    document.getElementById('thumb-preview').src = selected.thumbUrl;
    document.getElementById('file-info').innerHTML =
      `${esc(file.name)}<br>${(file.size / 1024 / 1024).toFixed(1)} MB・${formatDuration(selected.duration)}`;
    document.getElementById('title').value = file.name.replace(/\.[^.]+$/, '').slice(0, 100);
    dropzone.hidden = true;
    form.hidden = false;
    document.getElementById('title').focus();
  }

  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    handleFile(e.dataTransfer.files[0]);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const publishBtn = document.getElementById('publish-btn');
    const progress = document.getElementById('progress');
    const bar = document.getElementById('progress-bar');
    publishBtn.disabled = true;
    progress.hidden = false;

    const key = uid();
    const ext = (selected.file.name.split('.').pop() || 'mp4').toLowerCase();
    const videoPath = `${currentUser.id}/${key}.${ext}`;
    const thumbPath = `${currentUser.id}/${key}.jpg`;

    try {
      await uploadWithProgress('videos', videoPath, selected.file, p => { bar.style.width = `${Math.round(p * 95)}%`; });
      const { error: thumbError } = await sb.storage.from('thumbnails')
        .upload(thumbPath, selected.thumbBlob, { contentType: 'image/jpeg' });
      if (thumbError) throw thumbError;

      const { data, error } = await sb.from('videos').insert({
        user_id: currentUser.id,
        title: document.getElementById('title').value.trim(),
        description: document.getElementById('description').value.trim(),
        video_path: videoPath,
        thumbnail_path: thumbPath,
        duration: selected.duration,
      }).select('id').single();
      if (error) throw error;

      bar.style.width = '100%';
      toast('動画を公開しました');
      location.hash = `#/watch/${data.id}`;
    } catch (err) {
      console.error(err);
      // 途中まで上がったファイルを掃除する
      await Promise.all([
        sb.storage.from('videos').remove([videoPath]),
        sb.storage.from('thumbnails').remove([thumbPath]),
      ]);
      toast('アップロードに失敗しました。もう一度お試しください');
      publishBtn.disabled = false;
      progress.hidden = true;
      bar.style.width = '0';
    }
  });
}
