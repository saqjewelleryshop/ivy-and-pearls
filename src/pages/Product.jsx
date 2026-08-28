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
  const {slug}=useParams();
  const boot=useBootstrap();
  const cart=useCart();

  const [product,setProduct]=useState(
    boot.product?.slug===slug
      ? boot.product
      : null
  );

  const [related,setRelated]=useState([]);
  const [variantId,setVariantId]=useState(null);
  const [qty,setQty]=useState(1);
  const [activeImage,setActiveImage]=useState(0);

  useEffect(()=>{
    if(!product){
      getProduct(slug)
        .then(setProduct)
        .catch(()=>{});
    }
  },[slug]);

  useEffect(()=>{
    if(product){
      setVariantId(
        v=>v||product.variants?.[0]?.id
      );

      getProducts({
        category:product.category,
        limit:5
      })
        .then(items=>
          setRelated(
            items
              .filter(p=>p.id!==product.id)
              .slice(0,4)
          )
        )
        .catch(()=>{});
    }
  },[product?.id]);

  const variant=useMemo(
    ()=>
      product?.variants?.find(
        v=>v.id===variantId
      ) ||
      product?.variants?.[0],
    [product,variantId]
  );

  console.log('PRODUCT VARIANTS:',product?.variants);
  console.log('SELECTED VARIANT:',variant);
  console.log('VARIANT IMAGE:',variant?.image_url);

  const variantImage=
  variant?.image_url || null;


  useEffect(()=>{

  /*
   * Whenever the customer selects another variant,
   * reset the gallery to image 0.
   *
   * Because displayImages places the selected
   * variant image first, image 0 becomes the
   * correct variant image.
   */
  setActiveImage(0);

},[variant?.id]);


  if(!product){
    return (
      <section className="loading-page">
        Loading piece…
      </section>
    );
  }

  const images=product.images||[];

  const attributes=product.attributes||[];

  const displayAttributes=attributes.filter(
   attribute=>
     attribute.visible!==false &&
     Array.isArray(attribute.values) &&
     attribute.values.length>0
  );

  const image=
  variantImage
    ? {
        id:`variant-${variant?.id}`,
        url:variantImage,
        alt_text:
          `${product.title} - ${variant?.title||'variant'}`
      }
    : images[activeImage]||
      images[0];

  
  const inStock=
    variant &&
    (
      Number(variant.inventory_quantity)>0 ||
      variant.allow_backorder
    );

  const schema={
    "@context":"https://schema.org",
    "@type":"Product",
    name:product.title,

    description:
      product.short_description||
      product.description,

    image:
      images.map(i=>i.url),

    sku:
      variant?.sku,

    brand:{
      "@type":"Brand",
      name:"Ivy & Pearls"
    },

    offers:variant
      ? {
          "@type":"Offer",

          priceCurrency:"GBP",

          price:
            (
              variant.price_minor/100
            ).toFixed(2),

          availability:
            inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",

          url:
            `${SITE.url}/product/${product.slug}/`
        }
      : undefined
  };


  const breadcrumb={
    "@context":"https://schema.org",
    "@type":"BreadcrumbList",

    itemListElement:[
      {
        "@type":"ListItem",
        position:1,
        name:"Home",
        item:SITE.url
      },
      {
        "@type":"ListItem",
        position:2,
        name:"Shop",
        item:`${SITE.url}/shop/`
      },
      {
        "@type":"ListItem",
        position:3,
        name:product.title,
        item:
          `${SITE.url}/product/${product.slug}/`
      }
    ]
  };


  return (
    <>
      <Seo
        title={
          product.seo_title||
          product.title
        }

        description={
          product.seo_description||
          product.short_description||
          `Discover ${product.title} from Ivy & Pearls.`
        }

        path={
          `/product/${product.slug}/`
        }

        canonicalUrl={
          product.canonical_url||
          undefined
        }

        image={
          product.og_image_url||
          image?.url
        }

        ogTitle={
          product.og_title||
          undefined
        }

        ogDescription={
          product.og_description||
          undefined
        }

        robots={
          product.meta_robots||
          undefined
        }

        jsonLd={[
          schema,
          breadcrumb
        ]}
      />


      <main className="luxury-pdp">

        {/* =====================================================
            BREADCRUMBS
            ===================================================== */}

        <div className="luxury-pdp__breadcrumbs">

          <Link to="/">
            Home
          </Link>

          <span>/</span>

          <Link to="/shop/">
            Shop
          </Link>

          <span>/</span>

          <span>
            {product.title}
          </span>

        </div>


        {/* =====================================================
            PRODUCT HERO
            ===================================================== */}

        <section className="luxury-pdp__hero">


          {/* ===================================================
              PRODUCT GALLERY
              =================================================== */}

          <div className="luxury-gallery">

            <div className="luxury-gallery__main">

              {image
                ? (
                  <img
                    src={image.url}

                    alt={
                      image.alt_text||
                      product.title
                    }

                    width={
                      image.width||
                      1200
                    }

                    height={
                      image.height||
                      1400
                    }

                    loading="eager"
                  />
                )
                : (
                  <div className="luxury-gallery__empty"/>
                )
              }

            </div>


            {(product.images||[]).length>1&&(
              <div className="luxury-gallery__thumbs">

                {(product.images||[]).map((im,index)=>(
                  <button
                    type="button"

                    key={
                      im.id||
                      im.url||
                      index
                    }

                    className={
                      index===activeImage
                        ? 'is-active'
                        : ''
                    }

                    onClick={()=>
                      setActiveImage(index)
                    }

                    aria-label={
                      `View ${index+1}`
                    }
                  >
                    <img
                      src={im.url}
                      alt=""
                      loading="lazy"
                    />
                  </button>
                ))}

              </div>
            )}

          </div>


          {/* ===================================================
              PURCHASE PANEL
              =================================================== */}

          <aside className="luxury-pdp__aside">

            <div className="luxury-pdp__sticky">


              <p className="luxury-pdp__eyebrow">

                {
                  product.collection||
                  product.category
                }

              </p>


              <h1>
                {product.title}
              </h1>


            {displayAttributes.length>0&&(
            <div className="luxury-pdp__attribute-strip">

                {displayAttributes
                .slice(0,4)
                .map((attribute,index)=>(
                    <React.Fragment
                    key={
                        attribute.id||
                        attribute.name
                    }
                    >

                    <span>
                        {attribute.values.join(', ')}
                    </span>

                    {index<
                        Math.min(
                        displayAttributes.length,
                        4
                        )-1&&(
                        <i aria-hidden="true"/>
                    )}

                    </React.Fragment>
                ))
                }

            </div>
            )}

              <p className="luxury-pdp__price">

                {money(
                  variant?.price_minor||
                  product.price_minor
                )}

              </p>


              {product.short_description&&(
                <p className="luxury-pdp__intro">

                  {product.short_description}

                </p>
              )}


              {/* ===============================================
                  VARIANTS
                  =============================================== */}

              {product.variants?.length>1&&(

                <fieldset className="luxury-variants">

                  <div className="luxury-variants__top">

                    <legend>
                      Choose an option
                    </legend>

                    <button
                      type="button"
                      className="luxury-size-guide"
                    >
                      Size guide
                    </button>

                  </div>


                  <div className="luxury-variants__list">

                    {product.variants.map(v=>{

                      const unavailable=
                        !v.active ||
                        (
                          v.manage_stock &&
                          !v.allow_backorder &&
                          Number(
                            v.inventory_quantity
                          )<=0
                        );

                      return (
                        <button
                          type="button"

                          key={v.id}

                          className={
                            variant?.id===v.id
                              ? 'is-selected'
                              : ''
                          }

                          disabled={unavailable}

                          onClick={()=>
                            setVariantId(v.id)
                          }
                        >
                          {v.title}
                        </button>
                      );
                    })}

                  </div>

                </fieldset>

              )}


              {/* ===============================================
                  STOCK
                  =============================================== */}

              <div className="luxury-stock">

                {inStock
                  ? (
                    <>
                      <span className="luxury-stock__dot"/>

                      <span>
                        In stock
                      </span>
                    </>
                  )
                  : (
                    <span>
                      Currently unavailable
                    </span>
                  )
                }

              </div>


              {/* ===============================================
                  ADD TO BAG
                  =============================================== */}

              <div className="luxury-buy-row">

                <div className="luxury-qty">

                  <button
                    type="button"

                    aria-label="Decrease quantity"

                    onClick={()=>
                      setQty(
                        Math.max(
                          1,
                          qty-1
                        )
                      )
                    }
                  >
                    −
                  </button>


                  <span>
                    {qty}
                  </span>


                  <button
                    type="button"

                    aria-label="Increase quantity"

                    onClick={()=>
                      setQty(
                        Math.min(
                          10,
                          qty+1
                        )
                      )
                    }
                  >
                    +
                  </button>

                </div>


                <button
                  type="button"

                  className="luxury-add"

                  disabled={
                    !variant||
                    !inStock
                  }

                  onClick={()=>
                    cart.add(
                      product,
                      variant,
                      qty
                    )
                  }
                >

                  {
                    inStock
                      ? 'ADD TO BAG'
                      : 'OUT OF STOCK'
                  }

                </button>

              </div>


              {/* ===============================================
                  SHOPPING PROMISES
                  =============================================== */}

              <div className="luxury-promises">


                <div>

                  <span>
                    ◇
                  </span>

                  <p>

                    <strong>
                      Complimentary UK delivery
                    </strong>

                    <small>
                      Estimated 7–14 working days
                    </small>

                  </p>

                </div>


                <div>

                  <span>
                    ✦
                  </span>

                  <p>

                    <strong>
                      Client care
                    </strong>

                    <small>
                      {SITE.email}
                    </small>

                  </p>

                </div>


                <div>

                  <span>
                    ↺
                  </span>

                  <p>

                    <strong>
                      Delivery & returns
                    </strong>

                    <small>

                      <Link to="/delivery-returns/">
                        View full details
                      </Link>

                    </small>

                  </p>

                </div>


              </div>

            </div>

          </aside>

        </section>


        {/* =====================================================
            PRODUCT DETAILS
            ===================================================== */}

        <section className="luxury-product-copy">


          <div className="luxury-product-copy__intro">

            <p className="luxury-pdp__eyebrow">
              Product details
            </p>

            <h2>
              Considered in every detail.
            </h2>

          </div>


          <div className="luxury-product-copy__grid">


            <div
              className="luxury-description"

              dangerouslySetInnerHTML={{
                __html:
                  product.description||
                  '<p>Product details are shown here once confirmed.</p>'
              }}
            />


            <div className="luxury-specs">


              {product.material_summary&&(

                <div className="luxury-spec">

                  <span>
                    Material
                  </span>

                  <strong>
                    {product.material_summary}
                  </strong>

                </div>

              )}


              {product.category&&(

                <div className="luxury-spec">

                  <span>
                    Category
                  </span>

                  <strong>
                    {product.category}
                  </strong>

                </div>

              )}


              {product.collection&&(

                <div className="luxury-spec">

                  <span>
                    Collection
                  </span>

                  <strong>
                    {product.collection}
                  </strong>

                </div>

              )}


              {product.variants?.length>0&&(

                <div className="luxury-spec">

                  <span>
                    Options
                  </span>

                  <strong>
                    {
                      product.variants
                        .map(v=>v.title)
                        .join(', ')
                    }
                  </strong>

                </div>

              )}

            </div>

          </div>

        </section>


        {/* =====================================================
            ACCORDIONS
            ===================================================== */}

        <section className="luxury-accordions">

          {product.material_summary&&(

            <details>

              <summary>
                Materials
              </summary>

              <p>
                {product.material_summary}
              </p>

            </details>

          )}


          <details>

            <summary>
              Care instructions
            </summary>

            <p>

              {
                product.care||
                'Keep jewellery dry and away from perfume, cosmetics and household chemicals unless the product details state otherwise. Store separately in a soft, dry place.'
              }

            </p>

          </details>


          <details>

            <summary>
              Delivery & returns
            </summary>

            <p>

              Complimentary UK delivery is estimated at 7–14 working days.

              {' '}

              See our{' '}

              <Link to="/delivery-returns/">
                Delivery & Returns
              </Link>

              {' '}page for full details.

            </p>

          </details>


        </section>


        {/* =====================================================
            RELATED PRODUCTS
            ===================================================== */}

        {related.length>0&&(

          <section className="luxury-related">


            <div className="luxury-related__heading">

              <p className="luxury-pdp__eyebrow">
                You may also like
              </p>

              <h2>
                Pieces to consider.
              </h2>

            </div>


            <ProductGrid
              products={related}
            />


          </section>

        )}


      </main>

    </>
  );
}