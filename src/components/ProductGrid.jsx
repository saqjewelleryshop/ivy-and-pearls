import React from 'react';import ProductCard from './ProductCard';
export default function ProductGrid({products=[]}){return products.length?<div className="product-grid">{products.map(p=><ProductCard product={p} key={p.id}/>)}</div>:<div className="empty-state"><h2>Nothing here just yet.</h2><p>Our edit is being prepared. Please check back soon.</p></div>}
