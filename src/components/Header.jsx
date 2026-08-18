import React,{useEffect,useState} from 'react';
import {Link,NavLink} from 'react-router-dom';
import {NAV} from '../lib/config';
import {useCart} from '../context/CartContext';
import AnnouncementBar from './AnnouncementBar';
import {useAuth} from '../context/AuthContext';

export default function Header(){
 const cart=useCart();const {user}=useAuth();
 const [menu,setMenu]=useState(false),[hidden,setHidden]=useState(false),[atTop,setAtTop]=useState(true);
 useEffect(()=>{
   let last=scrollY,ticking=false;
   const update=()=>{const y=scrollY,cin=document.body.classList.contains('ip-cinematic-active');setAtTop(y<8);
     if(cin)setHidden(true);else if(y>last+7&&y>170)setHidden(true);else if(y<last-7)setHidden(false);if(y<8)setHidden(false);last=y;ticking=false};
   const on=()=>{if(!ticking){requestAnimationFrame(update);ticking=true}};addEventListener('scroll',on,{passive:true});return()=>removeEventListener('scroll',on)
 },[]);
 return <>
   <div className={`utility-wrap ${atTop?'':'utility-wrap--away'}`}><AnnouncementBar/></div>
   <header className={`site-header ${hidden?'site-header--hidden':''} ${atTop?'site-header--top':''}`}>
    <div className="site-header__main">
      <button className="menu-toggle" onClick={()=>setMenu(v=>!v)} aria-expanded={menu} aria-label={menu?'Close menu':'Open menu'}><span/><span/></button>
      <Link className="wordmark" to="/" aria-label="Ivy & Pearls home">Ivy <b>&amp;</b> Pearls</Link>
      <div className="header-actions">
        <Link to="/search/" aria-label="Search">Search</Link>
        <Link to="/wishlist/" aria-label="Wishlist">Saved</Link>
        <Link to={user?'/account/':'/login/'} aria-label="Account">{user?'Account':'Sign in'}</Link>
        <button onClick={()=>cart.setOpen(true)} aria-label={`Shopping bag with ${cart.count} items`}>Bag <span>{cart.count}</span></button>
      </div>
    </div>
    <nav className="desktop-nav" aria-label="Main navigation">{NAV.map(([n,p])=><NavLink key={p} to={p}>{n}</NavLink>)}</nav>
    <nav className={`mobile-menu ${menu?'is-open':''}`} aria-label="Mobile navigation">{NAV.map(([n,p])=><Link key={p} to={p} onClick={()=>setMenu(false)}>{n}</Link>)}<Link to="/wishlist/" onClick={()=>setMenu(false)}>Saved</Link><Link to={user?'/account/':'/login/'} onClick={()=>setMenu(false)}>Account</Link></nav>
   </header>
 </>
}
