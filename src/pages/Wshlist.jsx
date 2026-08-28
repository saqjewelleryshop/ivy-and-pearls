import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';

import Seo from '../components/Seo';
import ProductGrid from '../components/ProductGrid';
import {getProducts} from '../lib/api';

const WISHLIST_KEY='ivyandpearls_wishlist';

export default function Wishlist(){

  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);

  async function loadWishlist(){

    try{

      const ids=JSON.parse(
        localStorage.getItem(WISHLIST_KEY)||'[]'
      );

      if(!Array.isArray(ids)||!ids.length){
        setProducts([]);
        setLoading(false);
        return;
      }


      /*
       * Load live products from the catalogue,
       * then only keep those saved by the customer.
       */
      const catalogue=
        await getProducts({
          limit:60
        });


      const savedProducts=
        catalogue.filter(
          product=>
            ids.includes(product.id)
        );


      /*
       * Preserve the order they were added to wishlist.
       */
      savedProducts.sort(
        (a,b)=>
          ids.indexOf(a.id)-
          ids.indexOf(b.id)
      );


      setProducts(savedProducts);


    }catch(error){

      console.error(
        'Could not load wishlist:',
        error
      );

      setProducts([]);


    }finally{

      setLoading(false);

    }

  }


  useEffect(()=>{

    loadWishlist();


    /*
     * Update this page immediately when a heart
     * is clicked elsewhere.
     */
    function handleWishlistChange(){
      loadWishlist();
    }


    window.addEventListener(
      'ivy-wishlist-change',
      handleWishlistChange
    );


    return ()=>{

      window.removeEventListener(
        'ivy-wishlist-change',
        handleWishlistChange
      );

    };

  },[]);


  return (
    <>

      <Seo
        title="Wishlist | Ivy & Pearls"
        description="Save your favourite Ivy & Pearls pieces while you consider them."
        path="/wishlist/"
        noindex
      />


      <main className="wishlist-page">


        <section className="wishlist-hero">

          <div className="container">

            <p className="eyebrow">
              Saved pieces
            </p>


            <h1>
              Your <em>wishlist.</em>
            </h1>


            <p>
              Keep the pieces that caught your eye
              close while you decide.
            </p>

          </div>

        </section>


        <section className="section wishlist-content">

          <div className="container">


            {loading?(

              <div className="wishlist-loading">
                Loading your saved pieces…
              </div>

            ):products.length?(

              <>

                <div className="wishlist-toolbar">

                  <span>
                    {products.length}{' '}
                    {products.length===1
                      ? 'piece'
                      : 'pieces'
                    } saved
                  </span>


                  <button
                    type="button"
                    onClick={()=>{

                      const confirmed=
                        window.confirm(
                          'Clear your entire wishlist?'
                        );

                      if(!confirmed){
                        return;
                      }


                      localStorage.setItem(
                        WISHLIST_KEY,
                        '[]'
                      );


                      setProducts([]);


                      window.dispatchEvent(
                        new CustomEvent(
                          'ivy-wishlist-change',
                          {
                            detail:{
                              ids:[],
                              count:0
                            }
                          }
                        )
                      );

                    }}
                  >
                    Clear wishlist
                  </button>

                </div>


                <ProductGrid
                  products={products}
                />

              </>

            ):(

              <div className="wishlist-empty">


                <span
                  className="wishlist-empty__heart"
                  aria-hidden="true"
                >
                  ♡
                </span>


                <p className="eyebrow">
                  Nothing saved yet
                </p>


                <h2>
                  Your edit starts here.
                </h2>


                <p>
                  Tap the heart on any piece you love
                  and it will appear here.
                </p>


                <Link
                  to="/shop/"
                  className="button button--dark"
                >
                  Explore jewellery
                </Link>

              </div>

            )}


          </div>

        </section>

      </main>

    </>
  );

}