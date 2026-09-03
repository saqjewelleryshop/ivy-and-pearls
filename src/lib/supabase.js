import { createClient } from '@supabase/supabase-js';

let client;
export function supabaseBrowser(){
  if(typeof window==='undefined') return null;
  if(client)return client;
  const cfg = window.__IVY_CLIENT_CONFIG__ || {};
  const url=cfg.supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
  const key=cfg.supabaseKey || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
