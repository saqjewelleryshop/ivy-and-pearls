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

export async function removeAdminProduct(id, headers = {}) {
  return api(
    `/admin/products/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      headers
    }
  );
}

export async function bulkDeleteAdminVariants(
  productId,
  variantIds,
  headers={}
){
  return api(
    `/admin/products/${encodeURIComponent(productId)}/variants/bulk-delete`,
    {
      method:'POST',

      headers:{
        'Content-Type':'application/json',
        ...headers
      },

      body:JSON.stringify({
        variantIds
      })
    }
  );
}

export async function restoreAdminVariants(
  productId,
  variantIds,
  headers={}
){
  return api(
    `/admin/products/${encodeURIComponent(productId)}/variants/restore`,
    {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        ...headers
      },
      body:JSON.stringify({
        variantIds
      })
    }
  );
}

export async function uploadAdminProductImage(
  productId,
  file,
  headers={}
){
  const form=new FormData();

  form.append(
    'image',
    file
  );

  const response=await fetch(
    `/api/admin/products/${encodeURIComponent(productId)}/images/upload`,
    {
      method:'POST',
      headers,
      body:form
    }
  );

  let body={};

  try{
    body=await response.json();
  }catch{}

  if(!response.ok){
    throw new Error(
      body.error||
      `Upload failed (${response.status})`
    );
  }

  return body;
}