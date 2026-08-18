import React,{useEffect,useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import Seo from '../components/Seo';
import ProductGrid from '../components/ProductGrid';
import {getProduct,getProducts} from '../lib/api';
import {money} from '../lib/format';
import {useBootstrap} from '../context/BootstrapContext';
import {useCart} from '../context/CartContext';
import {SITE} from '../lib/config';

export default function Product(){
 const {slug}=useParams(),boot=useBootstrap(),cart=useCart();
 const [product,setProduct]=useState(boot.product?.slug===slug?boot.product:null),[related,setRelated]=useState([]),[variantId,setVariantId]=useState(null),[qty,setQty]=useState(1);
 useEffect(()=>{if(!product)getProduct(slug).then(setProduct).catch(()=>{})},[slug]);
 useEffect(()=>{if(product){setVariantId(v=>v||product.variants?.[0]?.id);getProducts({category:product.category,limit:5}).then(x=>setRelated(x.filter(p=>p.id!==product.id).slice(0,4))).catch(()=>{})}},[product?.id]);
 const variant=useMemo(()=>product?.variants?.find(v=>v.id===variantId)||product?.variants?.[0],[product,variantId]);
 if(!product)return <section className="loading-page">Loading piece…</section>;
 const image=product.images?.[0];
 const schema={"@context":"https://schema.org","@type":"Product",name:product.title,description:product.short_description||product.description,image:product.images?.map(i=>i.url)||[],sku:variant?.sku,brand:{"@type":"Brand","name":"Ivy & Pearls"},offers:variant?{"@type":"Offer",priceCurrency:"GBP",price:(variant.price_minor/100).toFixed(2),availability:variant.inventory_quantity>0?"https://schema.org/InStock":"https://schema.org/OutOfStock",url:`${SITE.url}/product/${product.slug}/`}:undefined};
 const breadcrumb={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:SITE.url},{"@type":"ListItem",position:2,name:"Shop",item:`${SITE.url}/shop/`},{"@type":"ListItem",position:3,name:product.title,item:`${SITE.url}/product/${product.slug}/`}]};
 return <><Seo title={product.seo_title||product.title} description={product.seo_description||product.short_description||`Discover ${product.title} from Ivy & Pearls.`} path={`/product/${product.slug}/`} canonicalUrl={product.canonical_url||undefined} image={product.og_image_url||image?.url} ogTitle={product.og_title||undefined} ogDescription={product.og_description||undefined} robots={product.meta_robots||undefined} jsonLd={[schema,breadcrumb]}/>
 <section className="pdp">
  <div className="pdp__gallery">{product.images?.length?product.images.map((im,i)=><img key={im.id||im.url} src={im.url} alt={im.alt_text||`${product.title} view ${i+1}`} loading={i<2?'eager':'lazy'} width={im.width||1000} height={im.height||1200}/>):<div className="pdp__image-empty"/>}</div>
  <div className="pdp__info"><p className="eyebrow">{product.collection||product.category}</p><h1>{product.title}</h1>{product.subtitle&&<p className="pdp__subtitle">{product.subtitle}</p>}<p className="pdp__price">{money(variant?.price_minor||product.price_minor)}</p><p className="pdp__short">{product.short_description}</p>
   {product.variants?.length>1&&<fieldset className="variant-picker"><legend>Choose an option</legend>{product.variants.map(v=><button type="button" key={v.id} className={variant?.id===v.id?'is-selected':''} onClick={()=>setVariantId(v.id)} disabled={!v.active}>{v.title}</button>)}</fieldset>}
   <div className="pdp__buy"><div className="qty"><button onClick={()=>setQty(Math.max(1,qty-1))} aria-label="Decrease quantity">−</button><span>{qty}</span><button onClick={()=>setQty(Math.min(10,qty+1))} aria-label="Increase quantity">+</button></div><button className="button button--dark" disabled={!variant||variant.inventory_quantity<1} onClick={()=>cart.add(product,variant,qty)}>{variant?.inventory_quantity>0?'Add to bag':'Out of stock'}</button></div>
   <div className="pdp__promises"><p>Complimentary UK delivery</p><p>Estimated 7–14 working days</p><p>Client Care: {SITE.email}</p></div>
   <details open><summary>Product details</summary><div dangerouslySetInnerHTML={{__html:product.description||'<p>Product details are shown here once confirmed.</p>'}}/></details>
   {product.material_summary&&<details><summary>Materials</summary><p>{product.material_summary}</p></details>}
   <details><summary>Care</summary><p>{product.care||'Keep jewellery dry and away from perfume, cosmetics and household chemicals unless the product details state otherwise. Store separately in a soft, dry place.'}</p></details>
   <details><summary>Delivery & returns</summary><p>Complimentary UK delivery is estimated at 7–14 working days. See our <Link to="/delivery-returns/">Delivery & Returns</Link> page for full details.</p></details>
  </div>
 </section>
 {related.length>0&&<section className="section section--ivory"><div className="container"><div className="section-heading"><p className="eyebrow">You may also like</p><h2>Considered <em>alongside.</em></h2></div><ProductGrid products={related}/></div></section>}
 </>;
}
