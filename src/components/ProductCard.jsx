import React from 'react';import {Link} from 'react-router-dom';import {money} from '../lib/format';import {useCart} from '../context/CartContext';
export default function ProductCard({product}){
 const cart=useCart();const image=product.images?.[0];const variant=product.variants?.[0];
 return <article className="product-card">
  <Link className="product-card__image" to={`/product/${product.slug}/`}>
   {image?<img src={image.url} alt={image.alt_text||product.title} loading="lazy" width={image.width||900} height={image.height||1080}/>:<div className="image-placeholder" aria-hidden="true"/>}
  </Link>
  <div className="product-card__meta"><div><h3><Link to={`/product/${product.slug}/`}>{product.title}</Link></h3>{product.subtitle&&<small>{product.subtitle}</small>}</div><p>{money(product.price_minor)}</p></div>
  {variant&&<button className="quick-add" disabled={variant.inventory_quantity<1} onClick={()=>cart.add(product,variant,1)}>{variant.inventory_quantity<1?'Out of stock':'Quick add +'}</button>}
 </article>
}
