// チャンネル登録ボタン（再生ページ・チャンネルページ共通）

async function getSubscriberCount(channelId) {
  const { count } = await sb.from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId);
  return count || 0;
}

async function isSubscribed(channelId) {
  if (!currentUser) return false;
  const { data } = await sb.from('subscriptions')
    .select('channel_id')
    .eq('subscriber_id', currentUser.id)
    .eq('channel_id', channelId)
    .maybeSingle();
  return !!data;
}

function subscribeButtonHtml(channelId, subscribed) {
  if (currentUser?.id === channelId) return '';
  return `<button class="btn ${subscribed ? '' : 'btn-primary'}" id="subscribe-btn">${subscribed ? '登録済み' : 'チャンネル登録'}</button>`;
}

// onChange(subscribed, delta) で登録者数表示を更新する
function bindSubscribeButton(channelId, subscribed, onChange) {
  const btn = document.getElementById('subscribe-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (!requireLogin()) return;
    btn.disabled = true;
    const { error } = subscribed
      ? await sb.from('subscriptions').delete().eq('subscriber_id', currentUser.id).eq('channel_id', channelId)
      : await sb.from('subscriptions').insert({ subscriber_id: currentUser.id, channel_id: channelId });
    btn.disabled = false;
    if (error) return toast('操作に失敗しました');
    subscribed = !subscribed;
    btn.textContent = subscribed ? '登録済み' : 'チャンネル登録';
    btn.classList.toggle('btn-primary', !subscribed);
    onChange?.(subscribed, subscribed ? 1 : -1);
  });
}
