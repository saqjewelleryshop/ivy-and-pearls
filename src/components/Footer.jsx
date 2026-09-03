import React from 'react';import {Link} from 'react-router-dom';import {SITE} from '../lib/config';
export default function Footer(){return <footer className="footer"><div className="container footer__top">
 <div><Link className="footer__mark" to="/">Ivy <b>&amp;</b> Pearls</Link><p>Quietly distinctive contemporary jewellery, chosen for everyday elegance.</p></div>
 <div><h3>Explore</h3><Link to="/shop/">Shop</Link><Link to="/collections/">Collections</Link><Link to="/new-arrivals/">New arrivals</Link><Link to="/the-ivy-edit/">The Ivy Edit</Link><Link to="/journal/">Journal</Link></div>
 <div><h3>Client care</h3><Link to="/contact/">Contact</Link><Link to="/delivery-returns/">Delivery & returns</Link><Link to="/faqs/">FAQs</Link><Link to="/privacy-policy/">Privacy</Link><Link to="/terms/">Terms</Link><Link to="/cookies/">Cookies</Link><Link to="/accessibility/">Accessibility</Link></div>
 </div><div className="container footer__bottom"><span>© {new Date().getFullYear()} {SITE.company}. Registered in England & Wales · Company no. {SITE.companyNumber}.</span><span>{SITE.email}</span></div></footer>}
