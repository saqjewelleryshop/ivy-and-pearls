import React from 'react';
import {Route,Routes} from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Collections from './pages/Collections';
import Collection from './pages/Collection';
import Product from './pages/Product';
import ProductPreview from './pages/ProductPreview';
import OrderConfirmed from './pages/OrderConfirmed';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Account from './pages/Account';
import OrderDetail from './pages/OrderDetail';
import Addresses from './pages/Addresses';
import OurStory from './pages/OurStory';
import Journal from './pages/Journal';
import JournalPost from './pages/JournalPost';
import Contact from './pages/Contact';
import DeliveryReturns from './pages/DeliveryReturns';
import Faqs from './pages/Faqs';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Cookies from './pages/Cookies';
import Accessibility from './pages/Accessibility';
import Wishlist from './pages/Wishlist';
import Search from './pages/Search';
import NotFound from './pages/NotFound';
import ScrollToTop from './components/ScrollToTop';
const Checkout=React.lazy(()=>import('./pages/Checkout'));
const Admin=React.lazy(()=>import('./pages/Admin'));
function Deferred({children}){return <React.Suspense fallback={<section className="loading-page" aria-live="polite">Loading…</section>}>{children}</React.Suspense>}
import SizeGuide from './pages/SizeGuide';
import JewelleryCare from './pages/JewelleryCare';
import Materials from './pages/Materials';
import PrivateClient from './pages/PrivateClient';
import Security from './pages/Security';


export default function App(){
    return (
    <Layout>
        <ScrollToTop/>
        <Routes>
            <Route path="/" element={<Home/>}/>
            <Route path="/shop/" element={<Shop/>}/>
            <Route path="/collections/" element={<Collections/>}/>
            <Route path="/collections/:slug/" element={<Collection/>}/>
            <Route path="/new-arrivals/" element={<Shop mode="new"/>}/>
            <Route path="/the-ivy-edit/" element={<Shop mode="ivy"/>}/>
            <Route path="/most-loved/" element={<Shop mode="ivy"/>}/>
            <Route path="/admin/preview/product/:slug/" element={<ProductPreview/>}/>
            <Route path="/product/:slug/" element={<Product/>}/>
            <Route path="/checkout/" element={<Deferred><Checkout/></Deferred>}/>
            <Route path="/order-confirmed/" element={<OrderConfirmed/>}/>
            <Route path="/login/" element={<Login/>}/>
            <Route path="/register/" element={<Register/>}/>
            <Route path="/forgot-password/" element={<ForgotPassword/>}/>
            <Route path="/reset-password/" element={<ResetPassword/>}/>
            <Route path="/account/" element={<Account/>}/>
            <Route path="/account/addresses/" element={<Addresses/>}/>
            <Route path="/account/orders/:orderNumber/" element={<OrderDetail/>}/>
            <Route path="/our-story/" element={<OurStory/>}/>
            <Route path="/journal/" element={<Journal/>}/>
            <Route path="/journal/:slug/" element={<JournalPost/>}/>
            <Route path="/contact/" element={<Contact/>}/>
            <Route path="/delivery-returns/" element={<DeliveryReturns/>}/>
            <Route path="/faqs/" element={<Faqs/>}/>
            <Route path="/privacy-policy/" element={<Privacy/>}/>
            <Route path="/terms/" element={<Terms/>}/>
            <Route path="/cookies/" element={<Cookies/>}/>
            <Route path="/accessibility/" element={<Accessibility/>}/>
            <Route path="/size-guide/" element={<SizeGuide/>}/>
            <Route path="/jewellery-care/" element={<JewelleryCare/>}/>
            <Route path="/materials/" element={<Materials/>}/>
            <Route path="/private-client/" element={<PrivateClient/>}/>
            <Route path="/security/" element={<Security/>}/>
            <Route path="/admin/" element={<Deferred><Admin/></Deferred>}/>
            <Route path="/wishlist/" element={<Wishlist/>}/>
            <Route path="/search/" element={<Search/>}/>
            <Route path="*" element={<NotFound/>}/>
        </Routes>
    </Layout>
    );
}
