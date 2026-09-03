import React, { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { NAV } from '../lib/config';
import { useCart } from '../context/CartContext';
import AnnouncementBar from './AnnouncementBar';
import { useAuth } from '../context/AuthContext';

const SearchIcon = () => (
  <svg
    width="21"
    height="21"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7.5" />
    <line x1="20.5" y1="20.5" x2="16.4" y2="16.4" />
  </svg>
);

const HeartIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7l1.1 1.1L12 21.1l7.7-7.6 1.1-1.1a5.4 5.4 0 0 0 0-7.7z" />
  </svg>
);

const UserIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="7" r="3.5" />
    <path d="M5 21v-1.5A5.5 5.5 0 0 1 10.5 14h3A5.5 5.5 0 0 1 19 19.5V21" />
  </svg>
);

const BagIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 8h12l1 13H5L6 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

export default function Header() {
  const cart = useCart();
  const { user } = useAuth();

  const [menu, setMenu] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [wishlistCount,setWishlistCount]=useState(0);

  useEffect(()=>{
    const read=()=>{
      try{
        const ids=JSON.parse(localStorage.getItem('ivyandpearls_wishlist')||'[]');
        setWishlistCount(Array.isArray(ids)?ids.length:0);
      }catch{setWishlistCount(0);}
    };
    read();
    window.addEventListener('ivy-wishlist-change',read);
    window.addEventListener('storage',read);
    return()=>{
      window.removeEventListener('ivy-wishlist-change',read);
      window.removeEventListener('storage',read);
    };
  },[]);

  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      const cinematic = document.body.classList.contains(
        'ip-cinematic-active'
      );

      setAtTop(y < 8);

      if (cinematic) {
        setHidden(true);
      } else if (y > last + 7 && y > 170) {
        setHidden(true);
      } else if (y < last - 7) {
        setHidden(false);
      }

      if (y < 8) {
        setHidden(false);
      }

      last = y;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <>
      <div
        className={`utility-wrap ${
          atTop ? '' : 'utility-wrap--away'
        }`}
      >
        <AnnouncementBar />
      </div>

      <header
        className={`site-header ${
          hidden ? 'site-header--hidden' : ''
        } ${atTop ? 'site-header--top' : ''}`}
      >
        {/* TOP ROW */}
        <div className="site-header__top">
          <button
            className="menu-toggle"
            type="button"
            onClick={() => setMenu((value) => !value)}
            aria-expanded={menu}
            aria-label={menu ? 'Close menu' : 'Open menu'}
          >
            <span />
            <span />
          </button>

          {/* ABSOLUTELY CENTERED LOGO */}
          <Link
            className="wordmark"
            to="/"
            aria-label="Ivy & Pearls home"
          >
            Ivy <b>&amp;</b> Pearls
          </Link>

          {/* ICONS — RIGHT SIDE ONLY */}
          <div className="header-actions">
            <Link
              className="header-icon"
              to="/search/"
              aria-label="Search"
              title="Search"
            >
              <SearchIcon />
            </Link>

            <Link
              className="header-icon"
              to="/wishlist/"
              aria-label={`Wishlist with ${wishlistCount} ${wishlistCount===1?'item':'items'}`}
              title="Wishlist"
            >
              <HeartIcon />
              {wishlistCount>0&&<span className="wishlist-count">{wishlistCount>99?'99+':wishlistCount}</span>}
            </Link>

            <Link
              className="header-icon"
              to={user ? '/account/' : '/login/'}
              aria-label={user ? 'My account' : 'Sign in'}
              title={user ? 'My account' : 'Sign in'}
            >
              <UserIcon />
            </Link>

            <button
              className="header-icon header-icon--bag"
              type="button"
              onClick={() => cart.setOpen(true)}
              aria-label={`Shopping bag with ${cart.count} ${
                cart.count === 1 ? 'item' : 'items'
              }`}
              title="Shopping bag"
            >
              <BagIcon />

              {cart.count > 0 && (
                <span className="bag-count">
                  {cart.count > 99 ? '99+' : cart.count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* CENTERED SECOND ROW */}
        <nav
          className="desktop-nav"
          aria-label="Main navigation"
        >
          {NAV.map(([name, path]) => (
            <NavLink key={path} to={path}>
              {name}
            </NavLink>
          ))}
        </nav>

        {/* MOBILE MENU */}
        <nav
          className={`mobile-menu ${
            menu ? 'is-open' : ''
          }`}
          aria-label="Mobile navigation"
        >
          {NAV.map(([name, path]) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMenu(false)}
            >
              {name}
            </Link>
          ))}

          <Link
            to="/wishlist/"
            onClick={() => setMenu(false)}
          >
            Saved
          </Link>

          <Link
            to={user ? '/account/' : '/login/'}
            onClick={() => setMenu(false)}
          >
            {user ? 'Account' : 'Sign in'}
          </Link>
        </nav>
      </header>
    </>
  );
}