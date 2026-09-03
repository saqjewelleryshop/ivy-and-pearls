import crypto from 'node:crypto';

const REDACT_KEYS=/authorization|cookie|token|secret|password|card|email|address|phone/i;
function safe(value,depth=0){
  if(depth>3)return '[truncated]';
  if(Array.isArray(value))return value.slice(0,20).map(v=>safe(v,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,REDACT_KEYS.test(k)?'[redacted]':safe(v,depth+1)]));
  return value;
}
export function requestContext(req){return {requestId:req.id,method:req.method,path:req.path};}
export function log(level,message,meta={}){
  const row={timestamp:new Date().toISOString(),level,message,...safe(meta)};
  const fn=level==='error'?console.error:level==='warn'?console.warn:console.log;
  fn(JSON.stringify(row));
}
export function requestId(req,res,next){
  req.id=String(req.get('x-request-id')||crypto.randomUUID()).slice(0,128);
  res.setHeader('X-Request-ID',req.id);
  next();
}
