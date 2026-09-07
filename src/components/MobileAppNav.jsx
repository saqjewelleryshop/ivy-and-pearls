import React from 'react';
import {NavLink} from 'react-router-dom';
import {useCart} from '../context/CartContext';
import {useAuth} from '../context/AuthContext';

function HomeIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.5 12 3l8.5 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-4v6H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg>}
function ShopIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/></svg>}
function HeartIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7l1.1 1.1L12 21.1l7.7-7.6 1.1-1.1a5.4 5.4 0 0 0 0-7.7z"/></svg>}
function UserIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="3.5"/><path d="M5 21v-1.5A5.5 5.5 0 0 1 10.5 14h3A5.5 5.5 0 0 1 19 19.5V21"/></svg>}

export default function MobileAppNav(){
  const cart=useCart();
  const {user}=useAuth();
  const itemClass=({isActive})=>`mobile-app-nav__item${isActive?' is-active':''}`;
  return <nav className="mobile-app-nav" aria-label="Mobile quick navigation">
    <NavLink to="/" end className={itemClass}><HomeIcon/><span>Home</span></NavLink>
    <NavLink to="/shop/" className={itemClass}><ShopIcon/><span>Shop</span></NavLink>
    <NavLink to="/wishlist/" className={itemClass}><HeartIcon/><span>Saved</span></NavLink>
    <NavLink to={user?'/account/':'/login/'} className={itemClass}><UserIcon/><span>{user?'Account':'Sign in'}</span></NavLink>
    <button type="button" className="mobile-app-nav__item mobile-app-nav__bag" onClick={()=>cart.setOpen(true)} aria-label={`Bag, ${cart.count} ${cart.count===1?'item':'items'}`}>
      <span className="mobile-app-nav__bag-icon"><ShopIcon/>{cart.count>0&&<b>{cart.count>9?'9+':cart.count}</b>}</span><span>Bag</span>
    </button>
  </nav>;
}
