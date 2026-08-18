import React,{useEffect,useState} from 'react';
import {Link,NavLink} from 'react-router-dom';
import {NAV} from '../lib/config';
import {useCart} from '../context/CartContext';
import AnnouncementBar from './AnnouncementBar';
import {useAuth} from '../context/AuthContext';

const SearchIcon=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const HeartIcon=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const UserIcon=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const BagIcon=({count})=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;

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
    <div className="site-header__top">
      <button className="menu-toggle" onClick={()=>setMenu(v=>!v)} aria-expanded={menu} aria-label={menu?'Close menu':'Open menu'}><span/><span/></button>
      <div className="header-actions">
        <Link to="/search/" aria-label="Search" className="header-icon"><SearchIcon/></Link>
        <Link to="/wishlist/" aria-label="Wishlist" className="header-icon"><HeartIcon/></Link>
        <Link to={user?'/account/':'/login/'} aria-label="Account" className="header-icon"><UserIcon/></Link>
        <button onClick={()=>cart.setOpen(true)} aria-label={`Shopping bag with ${cart.count} items`} className="header-icon header-icon--bag">
          <BagIcon count={cart.count}/>{cart.count>0&&<span className="bag-count">{cart.count}</span>}
        </button>
      </div>
    </div>
    <Link className="wordmark" to="/" aria-label="Ivy & Pearls home">Ivy <b>&amp;</b> Pearls</Link>
    <nav className="desktop-nav" aria-label="Main navigation">{NAV.map(([n,p])=><NavLink key={p} to={p}>{n}</NavLink>)}</nav>
    <nav className={`mobile-menu ${menu?'is-open':''}`} aria-label="Mobile navigation">{NAV.map(([n,p])=><Link key={p} to={p} onClick={()=>setMenu(false)}>{n}</Link>)}<Link to="/wishlist/" onClick={()=>setMenu(false)}>Saved</Link><Link to={user?'/account/':'/login/'} onClick={()=>setMenu(false)}>Account</Link></nav>
   </header>
 </>
}
