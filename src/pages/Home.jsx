import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import CinematicHero from '../components/CinematicHero';
import ProductGrid from '../components/ProductGrid';
import Newsletter from '../components/Newsletter';
import Seo from '../components/Seo';

import { getProducts } from '../lib/api';
import { COLLECTIONS, SITE } from '../lib/config';
import { useBootstrap } from '../context/BootstrapContext';

export default function Home() {
  const boot = useBootstrap();

  const [products, setProducts] = useState(
    boot.homeProducts || []
  );

  useEffect(() => {
    if (
      !products.length &&
      !boot.configurationPending
    ) {
      getProducts({ limit: 16 })
        .then(setProducts)
        .catch(() => {});
    }
  }, [boot.configurationPending, products.length]);

  const newArrivals = useMemo(
    () =>
      products
        .filter((product) => product.new_arrival)
        .slice(0, 4),
    [products]
  );

  const ivyEdit = useMemo(
    () =>
      products
        .filter((product) => product.ivy_edit)
        .slice(0, 4),
    [products]
  );

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    email: SITE.email,
    legalName: SITE.company,
  };

  return (
    <>
      <Seo
        description="Discover quietly distinctive contemporary jewellery from Ivy & Pearls, chosen for everyday elegance."
        path="/"
        image="/images/hero-gsap.webp"
        jsonLd={organizationSchema}
      />

      <CinematicHero />

      {/* =====================================================
          FEATURED COLLECTIONS
      ====================================================== */}

      <section className="section section--ivory home-collections">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">Explore</p>

            <h2>
              Featured
              <em>collections.</em>
            </h2>

            <p>
              Considered pieces for the details you return to
              every day.
            </p>
          </div>

          <div className="collection-grid">
            {COLLECTIONS.map((collection, index) => {

                const matchingProduct =
                    products.find(product =>
                    String(product.category || '').toLowerCase() ===
                    String(collection.slug || '').toLowerCase()
                    );

                const image =
                    matchingProduct?.images?.find(img => img.is_primary)?.url ||
                    matchingProduct?.images?.[0]?.url ||
                    null;

                return (
                    <Link
                    to={`/collections/${collection.slug}/`}
                    className="collection-card"
                    key={collection.slug}
                    >
                  <div className="collection-card__media">
                    {image ? (
                      <img
                        src={image}
                        alt={collection.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="collection-card__fallback">
                        <span>{collection.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="collection-card__content">
                    <span>
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <h3>{collection.name}</h3>

                    <p>{collection.copy}</p>

                    <b>Discover ↗</b>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================
          NEW ARRIVALS
          Do not render an empty ecommerce section.
      ====================================================== */}

      {newArrivals.length > 0 && (
        <section className="section home-products">
          <div className="container">
            <div className="section-heading section-heading--split">
              <div>
                <p className="eyebrow">Just in</p>

                <h2>
                  New
                  <em>arrivals.</em>
                </h2>
              </div>

              <Link
                className="editorial-link"
                to="/new-arrivals/"
              >
                View all ↗
              </Link>
            </div>

            <ProductGrid products={newArrivals} />
          </div>
        </section>
      )}

      {/* =====================================================
          EDITORIAL — LIGHT HELD CLOSE
      ====================================================== */}

      <section className="editorial-band">
        <div className="editorial-band__media">
          <img
            src="/images/editorial-jewellery.webp"
            alt="Ivy & Pearls jewellery styled in warm natural light"
            loading="lazy"
          />
        </div>

        <div className="editorial-band__copy">
          <p className="eyebrow">
            Contemporary jewellery for daily rituals
          </p>

          <h2>
            Light,
            <em>held close.</em>
          </h2>

          <p>
            Jewellery should feel considered without feeling
            precious. Pieces selected for ease, texture and
            the small rituals of getting dressed.
          </p>

          <Link
            className="editorial-link"
            to="/the-ivy-edit/"
          >
            Discover the Ivy Edit ↗
          </Link>
        </div>
      </section>

      {/* =====================================================
          THE IVY EDIT
          Only show when actual Ivy Edit products exist.
      ====================================================== */}

      {ivyEdit.length > 0 && (
        <section className="section section--dark home-ivy-edit">
          <div className="container">
            <div className="section-heading section-heading--split section-heading--light">
              <div>
                <p className="eyebrow">The Ivy Edit</p>

                <h2>
                  Chosen with
                  <em>intention.</em>
                </h2>
              </div>

              <p>
                A concise edit of pieces we return to for
                balance, wearability and quietly distinctive
                detail.
              </p>
            </div>

            <ProductGrid products={ivyEdit} />

            <div className="home-section-link">
              <Link to="/the-ivy-edit/">
                Discover the full edit ↗
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          LIFESTYLE
      ====================================================== */}

      <section className="lifestyle">
        <div className="lifestyle__copy">
          <p className="eyebrow">
            Everyday, considered
          </p>

          <h2>
            Made to move
            <em>with you.</em>
          </h2>

          <p>
            From first coffee to late dinners, jewellery that
            settles naturally into the way you dress.
          </p>

          <Link
            className="editorial-link"
            to="/shop/"
          >
            Shop all jewellery ↗
          </Link>
        </div>

        <div className="lifestyle__media">
          <img
            src="/images/lifestyle-jewellery.webp"
            alt="Ivy & Pearls jewellery worn as part of an everyday look"
            loading="lazy"
          />
        </div>
      </section>

      {/* =====================================================
          CONFIDENCE / TRUST
      ====================================================== */}

      <section className="section confidence">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">
              Why Ivy & Pearls
            </p>

            <h2>
              Chosen with
              <em>confidence.</em>
            </h2>
          </div>

          <div className="confidence-grid">
            <article>
              <span>01</span>

              <h3>Product clarity</h3>

              <p>
                Clear product information and considered
                imagery, so you can choose with confidence.
              </p>
            </article>

            <article>
              <span>02</span>

              <h3>Considered presentation</h3>

              <p>
                A restrained, premium experience from
                discovery through to delivery.
              </p>
            </article>

            <article>
              <span>03</span>

              <h3>Client care</h3>

              <p>
                Thoughtful support whenever you need a little
                guidance before or after ordering.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* =====================================================
          EDITORIAL GALLERY
          Reduced from six competing images to four.
      ====================================================== */}

      <section className="section section--ivory home-gallery">
        <div className="container">
          <div className="section-heading section-heading--split">
            <div>
              <p className="eyebrow">
                Styled by Ivy & Pearls
              </p>

              <h2>
                Light, texture
                <em>and detail.</em>
              </h2>
            </div>

            <p>
              A closer look at the pieces, textures and
              details that shape the Ivy & Pearls world.
            </p>
          </div>

          <div className="editorial-gallery">
            {[
              {
                file: 'gallery-1.webp',
                alt: 'Ivy & Pearls jewellery detail',
              },
              {
                file: 'gallery-2.webp',
                alt: 'Jewellery styled by Ivy & Pearls',
              },
              {
                file: 'gallery-3.webp',
                alt: 'Close-up jewellery styling',
              },
              {
                file: 'gallery-4.webp',
                alt: 'Ivy & Pearls everyday jewellery',
              },
            ].map((image, index) => (
              <figure
                key={image.file}
                className={`editorial-gallery__item editorial-gallery__item--${
                  index + 1
                }`}
              >
                <img
                  src={`/images/${image.file}`}
                  alt={image.alt}
                  loading="lazy"
                />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <Newsletter />
    </>
  );
}