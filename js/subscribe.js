// チャンネル登録ボタン（再生ページ・チャンネルページ共通）

async function getSubscriberCount(channelId) {
  const { count, error } = await sb.from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId);
  if (error) throw error;
  return count || 0;
}

async function isSubscribed(channelId) {
  if (!currentUser) return false;
  const data = must(await sb.from('subscriptions')
    .select('channel_id')
    .eq('subscriber_id', currentUser.id)
    .eq('channel_id', channelId)
    .maybeSingle());
  return !!data;
}

function subscribeButtonHtml(channelId, subscribed) {
  if (currentUser?.id === channelId) return '';
  return `<button class="btn ${subscribed ? '' : 'btn-primary'}" id="subscribe-btn" aria-pressed="${subscribed}">${subscribed ? '🔔 登録済み' : 'チャンネル登録'}</button>`;
}

// onChange(delta) で登録者数表示を更新する
function bindSubscribeButton(channelId, subscribed, onChange) {
  const btn = document.getElementById('subscribe-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!requireLogin()) return;
    if (subscribed && !confirm('チャンネル登録を解除しますか？')) return;
    btn.disabled = true;
    const { error } = subscribed
      ? await sb.from('subscriptions').delete().eq('subscriber_id', currentUser.id).eq('channel_id', channelId)
      : await sb.from('subscriptions').insert({ subscriber_id: currentUser.id, channel_id: channelId });
    btn.disabled = false;
    if (error) return toast(friendlyError(error), 'error');
    subscribed = !subscribed;
    btn.textContent = subscribed ? '🔔 登録済み' : 'チャンネル登録';
    btn.classList.toggle('btn-primary', !subscribed);
    btn.setAttribute('aria-pressed', subscribed);
    toast(subscribed ? 'チャンネル登録しました' : '登録を解除しました');
    onChange?.(subscribed ? 1 : -1);
    renderSidebar();
  });
}
