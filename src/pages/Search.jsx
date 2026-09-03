import React,{useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import Seo from '../components/Seo';
import ProductGrid from '../components/ProductGrid';
import {getProducts} from '../lib/api';

export default function Search(){
  const [params,setParams]=useSearchParams();
  const initial=params.get('q')||'';
  const [query,setQuery]=useState(initial);
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(Boolean(initial));

  useEffect(()=>{
    const q=params.get('q')||'';
    setQuery(q);
    if(!q.trim()){
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getProducts({q:q.trim(),limit:48})
      .then(setProducts)
      .catch(()=>setProducts([]))
      .finally(()=>setLoading(false));
  },[params]);

  const countLabel=useMemo(()=>{
    if(loading)return 'Searching…';
    if(!initial&&!params.get('q'))return 'Enter a search term';
    return `${products.length} ${products.length===1?'piece':'pieces'}`;
  },[loading,products.length,initial,params]);

  function submit(event){
    event.preventDefault();
    const q=query.trim();
    setParams(q?{q}:{});
  }

  return <>
    <Seo title="Search" description="Search the Ivy & Pearls jewellery collection." path="/search/" noindex/>
    <section className="page-hero page-hero--search">
      <div className="container">
        <p className="eyebrow">Find a piece</p>
        <h1>Search the <em>collection.</em></h1>
        <form className="search-page__form" onSubmit={submit} role="search">
          <label className="sr-only" htmlFor="site-search">Search jewellery</label>
          <input id="site-search" autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rings, bracelets, moissanite…"/>
          <button className="button button--dark" type="submit">Search</button>
        </form>
      </div>
    </section>
    <section className="section search-page__results">
      <div className="container">
        <div className="search-page__meta"><span>{countLabel}</span>{params.get('q')&&<span>for “{params.get('q')}”</span>}</div>
        {loading?<div className="loading-page">Searching the collection…</div>:products.length?<ProductGrid products={products}/>:params.get('q')?<div className="empty-state"><h2>No pieces found.</h2><p>Try a different material, category or style.</p></div>:null}
      </div>
    </section>
  </>;
}
