import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

export default function LuxuryMotion(){
  const {pathname}=useLocation();

  useEffect(()=>{
    if(typeof window==='undefined')return;
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(reduce)return;

    const selector=[
      '.section-heading',
      '.collection-card',
      '.product-card',
      '.editorial-band__copy',
      '.confidence-grid article',
      '.editorial-gallery__item',
      '.luxury-product-copy',
      '.luxury-accordions details',
      '.article__body > *'
    ].join(',');

    const nodes=[...document.querySelectorAll(selector)];
    nodes.forEach((node,index)=>{
      node.classList.add('luxury-reveal');
      node.style.setProperty('--reveal-delay',`${Math.min(index%4,3)*55}ms`);
    });

    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});

    nodes.forEach(node=>observer.observe(node));
    return()=>observer.disconnect();
  },[pathname]);

  return null;
}
