export async function api(path,options={}){
  const headers={...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})};
  const response=await fetch(`/api${path}`,{...options,headers});
  let body={};
  try{body=await response.json();}catch{}
  if(!response.ok)throw new Error(body.error||`Request failed (${response.status})`);
  return body;
}

export const getProducts=(params={})=>{
  const q=new URLSearchParams();
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')q.set(k,String(v));});
  return api(`/products${q.size?`?${q}`:''}`).then(r=>r.products);
};
export const getProduct=slug=>api(`/products/${encodeURIComponent(slug)}`).then(r=>r.product);
