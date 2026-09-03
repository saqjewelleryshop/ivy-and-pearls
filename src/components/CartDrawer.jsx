import React,{useEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import {useCart} from '../context/CartContext';
import {money} from '../lib/format';

export default function CartDrawer(){
  const c=useCart();
  const closeRef=useRef(null);
  const total=c.items.reduce((sum,item)=>sum+item.variant.price_minor*item.quantity,0);

  useEffect(()=>{
    if(!c.open)return;
    const previous=document.activeElement;
    closeRef.current?.focus();
    const onKeyDown=event=>{
      if(event.key==='Escape')c.setOpen(false);
    };
    document.addEventListener('keydown',onKeyDown);
    return()=>{
      document.removeEventListener('keydown',onKeyDown);
      previous?.focus?.();
    };
  },[c.open]);

  return <>
    <button className={`drawer-backdrop ${c.open?'is-open':''}`} onClick={()=>c.setOpen(false)} aria-label="Close bag" tabIndex={c.open?0:-1}/>
    <aside className={`cart-drawer ${c.open?'is-open':''}`} role="dialog" aria-modal="true" aria-label="Shopping bag" aria-hidden={!c.open}>
      <div className="cart-drawer__head"><h2>Your bag</h2><button ref={closeRef} onClick={()=>c.setOpen(false)} aria-label="Close shopping bag">×</button></div>
      <div className="cart-drawer__items">{c.items.length?c.items.map(item=>{
        const image=item.variant.image_url||item.product.images?.[0]?.url;
        return <div className="cart-item" key={item.variant.id}>
          {image&&<img src={image} alt=""/>}
          <div><h3>{item.product.title}</h3><p>{item.variant.title}</p><p>{money(item.variant.price_minor)}</p>
            <div className="qty"><button onClick={()=>c.setQty(item.variant.id,item.quantity-1)} aria-label={`Decrease quantity of ${item.product.title}`}>−</button><span>{item.quantity}</span><button onClick={()=>c.setQty(item.variant.id,item.quantity+1)} aria-label={`Increase quantity of ${item.product.title}`}>+</button></div>
            <button className="text-button" onClick={()=>c.remove(item.variant.id)}>Remove</button>
          </div>
        </div>;
      }):<p>Your bag is currently empty.</p>}</div>
      <div className="cart-drawer__foot"><div><span>Subtotal</span><strong>{money(total)}</strong></div><small>Complimentary UK delivery · Estimated 7–14 working days.</small>{c.items.length>0&&<Link className="button button--dark" to="/checkout/" onClick={()=>c.setOpen(false)}>Checkout</Link>}</div>
    </aside>
  </>;
}
