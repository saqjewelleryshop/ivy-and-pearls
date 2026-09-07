import { createClient } from '@supabase/supabase-js';

let client;
export function supabaseBrowser(){
  if(typeof window==='undefined') return null;
  if(client)return client;
  const url=import.meta.env.VITE_SUPABASE_URL;
  const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return null;
  client=createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
