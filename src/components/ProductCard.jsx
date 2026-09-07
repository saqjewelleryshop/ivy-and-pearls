import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {money} from '../lib/format';
import {useCart} from '../context/CartContext';

const WISHLIST_KEY='ivyandpearls_wishlist';

export default function ProductCard({product}){

  const cart=useCart();

  const image=product.images?.[0];
  const variant=product.variants?.[0];

  const [wished,setWished]=useState(false);


  /*
   * Load wishlist after mount.
   * Keeps React SSR/browser hydration safe.
   */
  useEffect(()=>{

    try{

      const saved=JSON.parse(
        localStorage.getItem(WISHLIST_KEY)||'[]'
      );

      setWished(
        saved.includes(product.id)
      );

    }catch{
      setWished(false);
    }

  },[product.id]);


  function toggleWishlist(event){

    event.preventDefault();
    event.stopPropagation();

    try{

      const saved=JSON.parse(
        localStorage.getItem(WISHLIST_KEY)||'[]'
      );

      const exists=
        saved.includes(product.id);


      const next=exists
        ? saved.filter(id=>id!==product.id)
        : [...saved,product.id];


      localStorage.setItem(
        WISHLIST_KEY,
        JSON.stringify(next)
      );


      setWished(!exists);


      /*
       * Lets the header / wishlist page update
       * immediately without refreshing.
       */
      window.dispatchEvent(
        new CustomEvent(
          'ivy-wishlist-change',
          {
            detail:{
              ids:next,
              count:next.length
            }
          }
        )
      );


    }catch(error){

      console.error(
        'Could not update wishlist:',
        error
      );

    }

  }


  return (

    <article className="product-card">


      {/* PRODUCT IMAGE */}

      <div className="product-card__media">

        <Link
          className="product-card__image"
          to={`/product/${product.slug}/`}
        >

          {image
            ? (
              <img
                src={image.url}
                alt={
                  image.alt_text||
                  product.title
                }
                loading="lazy"
                width={image.width||900}
                height={image.height||1080}
              />
            )
            : (
              <div
                className="image-placeholder"
                aria-hidden="true"
              />
            )
          }

        </Link>


        {/* WISHLIST HEART */}

        <button
          type="button"

          className={
            `product-card__wishlist ${
              wished
                ? 'is-active'
                : ''
            }`
          }

          onClick={toggleWishlist}

          aria-label={
            wished
              ? `Remove ${product.title} from wishlist`
              : `Add ${product.title} to wishlist`
          }

          aria-pressed={wished}
        >

          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"
            />
          </svg>

        </button>

      </div>


      {/* PRODUCT INFO */}

      <div className="product-card__meta">

        <div>

          <h3>

            <Link
              to={`/product/${product.slug}/`}
            >
              {product.title}
            </Link>

          </h3>


          {product.subtitle&&(
            <small>
              {product.subtitle}
            </small>
          )}

        </div>


        <p>
          {money(product.price_minor)}
        </p>

      </div>


      {/* QUICK ADD */}

      {variant&&(

        <button
          type="button"

          className="quick-add"

          disabled={
            variant.inventory_quantity<1
          }

          onClick={()=>
            cart.add(
              product,
              variant,
              1
            )
          }
        >

          {variant.inventory_quantity<1
            ? 'Out of stock'
            : 'Quick add +'
          }

        </button>

      )}

    </article>

  );

}