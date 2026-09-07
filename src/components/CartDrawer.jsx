import React from 'react';import {Link} from 'react-router-dom';import {useCart} from '../context/CartContext';import {money} from '../lib/format';
export default function CartDrawer(){const c=useCart();const total=c.items.reduce((s,i)=>s+i.variant.price_minor*i.quantity,0);
 return <><button className={`drawer-backdrop ${c.open?'is-open':''}`} onClick={()=>c.setOpen(false)} aria-label="Close bag"/><aside className={`cart-drawer ${c.open?'is-open':''}`} aria-hidden={!c.open}>
 <div className="cart-drawer__head"><h2>Your bag</h2><button onClick={()=>c.setOpen(false)} aria-label="Close">×</button></div>
 <div className="cart-drawer__items">{c.items.length?c.items.map(i=><div className="cart-item" key={i.variant.id}>
  {i.product.images?.[0]&&<img src={i.product.images[0].url} alt=""/>}<div><h3>{i.product.title}</h3><p>{i.variant.title}</p><p>{money(i.variant.price_minor)}</p>
  <div className="qty"><button onClick={()=>c.setQty(i.variant.id,i.quantity-1)} aria-label="Decrease quantity">−</button><span>{i.quantity}</span><button onClick={()=>c.setQty(i.variant.id,i.quantity+1)} aria-label="Increase quantity">+</button></div>
  <button className="text-button" onClick={()=>c.remove(i.variant.id)}>Remove</button></div></div>):<p>Your bag is currently empty.</p>}</div>
 <div className="cart-drawer__foot"><div><span>Subtotal</span><strong>{money(total)}</strong></div><small>Complimentary UK delivery. Taxes included where applicable.</small>{c.items.length>0&&<Link className="button button--dark" to="/checkout/" onClick={()=>c.setOpen(false)}>Checkout</Link>}</div>
 </aside></>
}
