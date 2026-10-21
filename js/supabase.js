// Supabase クライアントとログイン状態

const SUPABASE_URL = 'https://ahttcdatrqjafifjbafo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0v5ZU0nA2P58IJYeeh_FNA_QTVluUiJ';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;

async function loadSession() {
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user ?? null;
  currentProfile = null;
  if (currentUser) {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    currentProfile = data;
  }
}

function publicUrl(bucket, path) {
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function requireLogin() {
  if (currentUser) return true;
  toast('ログインしてください');
  location.hash = '#/login';
  return false;
}
