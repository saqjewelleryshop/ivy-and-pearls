import React,{useEffect,useState} from 'react';
import Seo from '../components/Seo';
import ProductGrid from '../components/ProductGrid';
import {getProducts} from '../lib/api';

export default function Search(){
  const [query,setQuery]=useState('');
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    const q=query.trim();
    if(q.length<2){
      setProducts([]);
      return;
    }

    const timer=setTimeout(async()=>{
      setLoading(true);
      try{
        setProducts(await getProducts({q,limit:48}));
      }catch{
        setProducts([]);
      }finally{
        setLoading(false);
      }
    },250);

    return()=>clearTimeout(timer);
  },[query]);

  return <>
    <Seo title="Search" description="Search Ivy & Pearls jewellery." path="/search/" noindex/>
    <section className="page-hero search-hero">
      <div className="container">
        <p className="eyebrow">Search</p>
        <h1>Find your <em>piece.</em></h1>
        <label className="search-page__field">
          <span className="sr-only">Search jewellery</span>
          <input autoFocus type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search rings, bracelets, necklaces…"/>
        </label>
      </div>
    </section>
    <section className="section">
      <div className="container">
        {loading?<div className="empty-state">Searching…</div>:
          query.trim().length<2?<div className="empty-state"><h2>Start typing to search.</h2></div>:
          products.length?<ProductGrid products={products}/>:<div className="empty-state"><h2>No pieces found.</h2><p>Try another product name or category.</p></div>}
      </div>
    </section>
  </>;
}
