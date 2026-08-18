import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabase() {
  return Boolean(url && serviceKey);
}

export function supabaseAdmin() {
  if (!hasSupabase()) {
    const err = new Error('Supabase server credentials are not configured.');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}

export async function getUserFromRequest(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !hasSupabase()) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error) return null;
  return data.user || null;
}

export async function requireUser(req, res, next) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  req.user = user;
  next();
}

export async function requireAdmin(req, res, next) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const db = supabaseAdmin();
  const { data } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (data?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  req.user = user;
  next();
}
