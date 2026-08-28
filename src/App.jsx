import React from 'react';
import {Route,Routes} from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Collections from './pages/Collections';
import Collection from './pages/Collection';
import Product from './pages/Product';
import ProductPreview from './pages/ProductPreview';
import Checkout from './pages/Checkout';
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
import Admin from './pages/Admin';
import Wishlist from './pages/Wshlist';
import NotFound from './pages/NotFound';
import ScrollToTop from './components/ScrollToTop';

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
            <Route path="/checkout/" element={<Checkout/>}/>
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
            <Route path="/admin/" element={<Admin/>}/>
            <Route path="/wishlist/" element={<Wishlist/>}/>
            <Route path="*" element={<NotFound/>}/>
        </Routes>
    </Layout>
    );
}
