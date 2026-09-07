import React,{useEffect} from 'react';
import {Link} from 'react-router-dom';
import {useCart} from '../context/CartContext';
import {money} from '../lib/format';

function CloseIcon(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  );
}

function BagMark(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h12l1 13H5L6 8Z"/>
      <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
    </svg>
  );
}

export default function CartDrawer(){
  const cart=useCart();

  const total=cart.items.reduce(
    (sum,item)=>sum+item.variant.price_minor*item.quantity,
    0
  );

  useEffect(()=>{
    if(typeof document==='undefined')return undefined;

    const previous=document.body.style.overflow;

    if(cart.open){
      document.body.style.overflow='hidden';
    }

    return ()=>{
      document.body.style.overflow=previous;
    };
  },[cart.open]);

  return (
    <>
      <button
        className={`drawer-backdrop ${cart.open?'is-open':''}`}
        onClick={()=>cart.setOpen(false)}
        aria-label="Close shopping bag"
        tabIndex={cart.open?0:-1}
      />

      <aside
        className={`cart-drawer luxury-cart ${cart.open?'is-open':''}`}
        aria-hidden={!cart.open}
        aria-label="Shopping bag"
      >
        <header className="luxury-cart__head">
          <div>
            <p className="luxury-cart__eyebrow">Ivy &amp; Pearls</p>
            <h2>Your bag</h2>
            <span className="luxury-cart__count">
              {cart.count} {cart.count===1?'piece':'pieces'}
            </span>
          </div>

          <button
            type="button"
            className="luxury-cart__close"
            onClick={()=>cart.setOpen(false)}
            aria-label="Close shopping bag"
          >
            <CloseIcon/>
          </button>
        </header>

        <div className="luxury-cart__body">
          {cart.items.length?(
            <div className="luxury-cart__items">
              {cart.items.map(item=>{
                const imageUrl=
                  item.variant.image_url||
                  item.product.images?.[0]?.url;

                return (
                  <article
                    className="luxury-cart-item"
                    key={item.variant.id}
                  >
                    <Link
                      className="luxury-cart-item__media"
                      to={`/product/${item.product.slug}/`}
                      onClick={()=>cart.setOpen(false)}
                    >
                      {imageUrl?(
                        <img
                          src={imageUrl}
                          alt={item.product.title}
                          loading="lazy"
                        />
                      ):(
                        <span className="luxury-cart-item__placeholder"/>
                      )}
                    </Link>

                    <div className="luxury-cart-item__content">
                      <div className="luxury-cart-item__top">
                        <div>
                          <h3>
                            <Link
                              to={`/product/${item.product.slug}/`}
                              onClick={()=>cart.setOpen(false)}
                            >
                              {item.product.title}
                            </Link>
                          </h3>

                          {item.variant.title&&(
                            <p className="luxury-cart-item__variant">
                              {item.variant.title}
                            </p>
                          )}
                        </div>

                        <strong className="luxury-cart-item__price">
                          {money(item.variant.price_minor*item.quantity)}
                        </strong>
                      </div>

                      <div className="luxury-cart-item__actions">
                        <div className="luxury-cart-qty" aria-label="Quantity">
                          <button
                            type="button"
                            onClick={()=>cart.setQty(item.variant.id,item.quantity-1)}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            onClick={()=>cart.setQty(item.variant.id,item.quantity+1)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="luxury-cart-item__remove"
                          onClick={()=>cart.remove(item.variant.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ):(
            <div className="luxury-cart-empty">
              <span className="luxury-cart-empty__icon"><BagMark/></span>
              <p className="luxury-cart__eyebrow">Your edit awaits</p>
              <h3>Your bag is empty.</h3>
              <p>
                Discover considered pieces selected for everyday elegance.
              </p>
              <Link
                className="luxury-cart-empty__shop"
                to="/shop/"
                onClick={()=>cart.setOpen(false)}
              >
                Explore the collection
              </Link>
            </div>
          )}
        </div>

        <footer className="luxury-cart__foot">
          <div className="luxury-cart__delivery">
            <span>Complimentary UK delivery</span>
            <small>Estimated 7–14 working days</small>
          </div>

          <div className="luxury-cart__subtotal">
            <span>Subtotal</span>
            <strong>{money(total)}</strong>
          </div>

          <p className="luxury-cart__note">
            Taxes included where applicable. Delivery and returns details are available before payment.
          </p>

          {cart.items.length>0&&(
            <Link
              className="luxury-cart__checkout"
              to="/checkout/"
              onClick={()=>cart.setOpen(false)}
            >
              Continue to secure checkout
              <span aria-hidden="true">→</span>
            </Link>
          )}

          {cart.items.length>0&&(
            <button
              type="button"
              className="luxury-cart__continue"
              onClick={()=>cart.setOpen(false)}
            >
              Continue shopping
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
