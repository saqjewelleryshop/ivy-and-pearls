import React,{useEffect,useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import Seo from '../components/Seo';
import {api} from '../lib/api';
import {money} from '../lib/format';
import {useAuth} from '../context/AuthContext';
import {SITE} from '../lib/config';

export default function ProductPreview(){
 const {slug}=useParams(),{session,user,loading}=useAuth();const [product,setProduct]=useState(null),[variantId,setVariantId]=useState(null),[error,setError]=useState('');
 useEffect(()=>{if(!session?.access_token)return;api(`/admin/products/preview/${encodeURIComponent(slug)}`,{headers:{Authorization:`Bearer ${session.access_token}`}}).then(r=>{setProduct(r.product);setVariantId(r.product?.variants?.[0]?.id||null)}).catch(e=>setError(e.message))},[slug,session?.access_token]);
 const variant=useMemo(()=>product?.variants?.find(v=>v.id===variantId)||product?.variants?.[0],[product,variantId]);
 if(loading)return <section className="loading-page">Loading admin preview…</section>;
 if(!user)return <section className="loading-page"><h1>Admin sign-in required</h1><Link to="/login/">Sign in</Link></section>;
 if(error)return <section className="loading-page"><h1>Preview unavailable</h1><p>{error}</p><Link to="/admin/">Return to admin</Link></section>;
 if(!product)return <section className="loading-page">Loading preview…</section>;
 return <><Seo title={`Preview — ${product.title}`} description="Administrator product preview." path={`/admin/preview/product/${product.slug}/`} noindex/>
 <div className="admin-preview-banner"><strong>ADMIN PREVIEW — NOT PUBLIC</strong><span>Status: {String(product.status).replaceAll('_',' ')}</span><Link to="/admin/">Back to admin</Link></div>
 <section className="pdp"><div className="pdp__gallery">{product.images?.length?product.images.map((im,i)=><img key={im.id||im.url} src={im.url} alt={im.alt_text||`${product.title} view ${i+1}`} loading={i<2?'eager':'lazy'} width={im.width||1000} height={im.height||1200}/>):<div className="pdp__image-empty"/>}</div><div className="pdp__info"><p className="eyebrow">{product.collection||product.category}</p><h1>{product.title}</h1>{product.subtitle&&<p className="pdp__subtitle">{product.subtitle}</p>}<p className="pdp__price">{money(variant?.price_minor||0)}</p><p className="pdp__short">{product.short_description}</p>{product.variants?.length>1&&<fieldset className="variant-picker"><legend>Choose an option</legend>{product.variants.map(v=><button type="button" key={v.id} className={variant?.id===v.id?'is-selected':''} onClick={()=>setVariantId(v.id)}>{v.title}</button>)}</fieldset>}<div className="pdp__promises"><p>Complimentary UK delivery</p><p>Estimated 7–14 working days</p><p>Client Care: {SITE.email}</p></div><details open><summary>Product details</summary><div dangerouslySetInnerHTML={{__html:product.description||'<p>Product details are shown here once confirmed.</p>'}}/></details>{product.material_summary&&<details><summary>Materials</summary><p>{product.material_summary}</p></details>}<details><summary>Care</summary><p>{product.care||'Keep jewellery dry and away from perfume, cosmetics and household chemicals unless the product details state otherwise. Store separately in a soft, dry place.'}</p></details></div></section></>;
}
