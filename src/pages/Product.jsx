import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import Seo from '../components/Seo';
import NotFound from './NotFound';
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
  const [manualImage,setManualImage]=useState(false);
  const [lightbox,setLightbox]=useState(false);
  const touchStartX=useRef(null);

  useEffect(()=>{
    if(!product&&!boot.notFound){
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


  const variantImage=
  variant?.image_url || null;


  useEffect(()=>{

  /* Reset to the primary gallery position when the selected option changes. */
  setActiveImage(0);
  setManualImage(false);

},[variant?.id]);


  if(!product){
    if(boot.notFound)return <NotFound/>;
    return (
      <section className="loading-page">
        Loading piece…
      </section>
    );
  }

  const images=product.images||[];

  const galleryImages=(()=>{
    const variantEntry=variantImage
      ? {
          id:`variant-${variant?.id}`,
          url:variantImage,
          alt_text:`${product.title} - ${variant?.title||'variant'}`
        }
      : null;

    return variantEntry
      ? [variantEntry,...images.filter(item=>item?.url&&item.url!==variantImage)]
      : images;
  })();

  const attributes=product.attributes||[];

  const displayAttributes=attributes.filter(
   attribute=>
     attribute.visible!==false &&
     Array.isArray(attribute.values) &&
     attribute.values.length>0
  );

  const displayedIndex=
    !manualImage && variantImage
      ? 0
      : variantImage
        ? Math.min(activeImage+1,Math.max(galleryImages.length-1,0))
        : Math.min(activeImage,Math.max(galleryImages.length-1,0));

  const image=galleryImages[displayedIndex]||galleryImages[0];

  const moveGallery=(direction)=>{
    if(galleryImages.length<2)return;
    const nextIndex=(displayedIndex+direction+galleryImages.length)%galleryImages.length;

    if(variantImage&&nextIndex===0){
      setActiveImage(0);
      setManualImage(false);
      return;
    }

    setActiveImage(variantImage?nextIndex-1:nextIndex);
    setManualImage(true);
  };

  
  const schemaImages=[...new Set([
    ...images.map(i=>i.url).filter(Boolean),
    ...(product.variants||[]).map(v=>v.image_url).filter(Boolean)
  ])];

  const hasFinishVariants=(product.variants||[]).some(v=>
    /gold|silver|rose|white|finish|tone|colour|color/i.test(String(v.title||''))
  );

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

    image:schemaImages,

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

            <div className="luxury-gallery__main" onTouchStart={e=>{touchStartX.current=e.changedTouches?.[0]?.clientX??null;}} onTouchEnd={e=>{if(touchStartX.current==null)return;const delta=(e.changedTouches?.[0]?.clientX??touchStartX.current)-touchStartX.current;if(Math.abs(delta)>45)moveGallery(delta<0?1:-1);touchStartX.current=null;}}>

              {galleryImages.length>1&&(<button type="button" className="luxury-gallery__arrow luxury-gallery__arrow--prev" aria-label="Previous product image" onClick={()=>moveGallery(-1)}><span aria-hidden="true">‹</span></button>)}

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
                    onClick={()=>setLightbox(true)}
                    className="luxury-gallery__hero-image"
                  />
                )
                : (
                  <div className="luxury-gallery__empty"/>
                )
              }

              {galleryImages.length>1&&(<button type="button" className="luxury-gallery__arrow luxury-gallery__arrow--next" aria-label="Next product image" onClick={()=>moveGallery(1)}><span aria-hidden="true">›</span></button>)}

              {galleryImages.length>1&&(<div className="luxury-gallery__count" aria-live="polite">{displayedIndex+1} / {galleryImages.length}</div>)}
              {image&&<button type="button" className="luxury-gallery__zoom" onClick={()=>setLightbox(true)} aria-label="Open full-screen image">⌕</button>}

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
                      ((manualImage||!variantImage)&&index===activeImage)
                        ? 'is-active'
                        : ''
                    }

                    onClick={()=>{
                      setActiveImage(index);
                      setManualImage(true);
                    }}

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

          {lightbox&&image&&<div className="product-lightbox" role="dialog" aria-modal="true" aria-label={`${product.title} image viewer`} onClick={()=>setLightbox(false)}><button type="button" className="product-lightbox__close" aria-label="Close image viewer" onClick={()=>setLightbox(false)}>×</button>{galleryImages.length>1&&<button type="button" className="product-lightbox__nav product-lightbox__nav--prev" aria-label="Previous image" onClick={e=>{e.stopPropagation();moveGallery(-1)}}>‹</button>}<img src={image.url} alt={image.alt_text||product.title} onClick={e=>e.stopPropagation()}/>{galleryImages.length>1&&<button type="button" className="product-lightbox__nav product-lightbox__nav--next" aria-label="Next image" onClick={e=>{e.stopPropagation();moveGallery(1)}}>›</button>}</div>}


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
                      {hasFinishVariants?'Finish':'Choose an option'}
                    </legend>

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

                          aria-pressed={variant?.id===v.id}

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


              <div className="luxury-sizing-link"><Link to="/size-guide/">Need help choosing a size? <span>View the size guide →</span></Link></div>

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