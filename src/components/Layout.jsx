import React from 'react';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import ChatWidget from './ChatWidget';
import CookieBanner from './CookieBanner';
import MobileAppNav from './MobileAppNav';

export default function Layout({children}){
  return <>
    <Header/>
    <main id="main-content">{children}</main>
    <Footer/>
    <CartDrawer/>
    <MobileAppNav/>
    <ChatWidget/>
    <CookieBanner/>
  </>;
}
