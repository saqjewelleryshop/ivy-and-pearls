import React,{useLayoutEffect,useRef} from 'react';
import {Link} from 'react-router-dom';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {HOME} from '../lib/content';

export default function CinematicHero(){
 const ref=useRef(null);
 useLayoutEffect(()=>{
  if(typeof window==='undefined'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  gsap.registerPlugin(ScrollTrigger);
  const hero=ref.current;if(!hero)return;
  const ctx=gsap.context(()=>{
    const f=[1,2,3,4,5].map(n=>hero.querySelector(`.ip-frame-${n}`));
    const [f1,f2,f3,f4,f5]=f;const type1=f2.querySelector('.ip-cinematic-type'),type2=f4.querySelector('.ip-cinematic-type'),final=f5.querySelector('.hero-final'),intro=f1.querySelector('.hero-intro');
    gsap.set(f1,{autoAlpha:1});gsap.set(f.slice(1),{autoAlpha:0});gsap.set([type1,type2],{autoAlpha:0,y:22});gsap.set(final,{autoAlpha:0,y:20});
    const tl=gsap.timeline({defaults:{ease:'none'},scrollTrigger:{trigger:hero,start:'top top',end:'+=450%',pin:true,scrub:.6,anticipatePin:1,invalidateOnRefresh:true,onUpdate:self=>{
      if(self.progress>.015&&self.progress<.995)document.body.classList.add('ip-cinematic-active');else document.body.classList.remove('ip-cinematic-active');
    },onLeave:()=>document.body.classList.remove('ip-cinematic-active'),onLeaveBack:()=>document.body.classList.remove('ip-cinematic-active')}});
    tl.to(f1.querySelector('img'),{scale:1.025,duration:1.25})
      .to(intro,{autoAlpha:0,y:-18,duration:.3},.72)
      .to(f1.querySelector('img'),{filter:'brightness(.10)',scale:1.035,duration:.4},1.03)
      .to(f1,{autoAlpha:0,duration:.14},1.4).to(f2,{autoAlpha:1,duration:.14},1.4)
      .to(type1,{autoAlpha:1,y:0,duration:.42,ease:'power2.out'},1.52).to({},{duration:.7})
      .to(type1,{autoAlpha:0,y:-18,duration:.26}).to(f2,{autoAlpha:0,duration:.15}).to(f3,{autoAlpha:1,duration:.22},'<')
      .fromTo(f3.querySelector('img'),{filter:'brightness(.10)',scale:1.03},{filter:'brightness(1)',scale:1,duration:.85})
      .to({},{duration:.5}).to(f3.querySelector('img'),{filter:'brightness(.08)',scale:1.025,duration:.38})
      .to(f3,{autoAlpha:0,duration:.14}).to(f4,{autoAlpha:1,duration:.14},'<')
      .to(type2,{autoAlpha:1,y:0,duration:.42,ease:'power2.out'}).to({},{duration:.7})
      .to(type2,{autoAlpha:0,y:-18,duration:.26}).to(f4,{autoAlpha:0,duration:.15}).to(f5,{autoAlpha:1,duration:.22},'<')
      .fromTo(f5.querySelector('img'),{filter:'brightness(.10)',scale:1.03},{filter:'brightness(1)',scale:1,duration:.9})
      .to(final,{autoAlpha:1,y:0,duration:.42,ease:'power2.out'}).to({},{duration:.8});
    gsap.to('.ip-cinematic-progress__fill',{scaleX:1,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'+=450%',scrub:true}});
  },ref);
  return()=>{document.body.classList.remove('ip-cinematic-active');ctx.revert()}
 },[]);
 return <section className="ip-cinematic-hero" ref={ref} aria-label="Ivy & Pearls collection">
  <div className="ip-cinematic-hero__stage">
   <div className="ip-cinematic-frame ip-frame-1"><img src="/images/hero-gsap.webp" alt="Model wearing Ivy & Pearls pearl earrings" fetchpriority="high" decoding="async"/><div className="green-veil"/><div className="hero-intro container"><p className="hero-intro__eyebrow">{HOME.hero.eyebrow}</p><h1 className="hero-intro__title">{HOME.hero.title}<em>{HOME.hero.accent}</em></h1><p className="hero-intro__copy">{HOME.hero.copy}</p><Link className="hero-intro__button" to="/shop/"><span>SHOP THE COLLECTION</span><span aria-hidden="true">↗</span></Link></div></div>
   <div className="ip-cinematic-frame ip-frame-2"><div className="ip-cinematic-type"><p className="ip-cinematic-type__eyebrow">Ivy &amp; Pearls</p><span className="ip-cinematic-type__rule"/><h2>Quietly distinctive <em>jewellery.</em></h2><p className="ip-cinematic-type__sub">Chosen for everyday elegance.</p></div></div>
   <div className="ip-cinematic-frame ip-frame-3"><img src="/images/hero-gsap2.webp" alt="" decoding="async"/><div className="green-veil green-veil--soft"/></div>
   <div className="ip-cinematic-frame ip-frame-4"><div className="ip-cinematic-type"><p className="ip-cinematic-type__eyebrow">Ivy &amp; Pearls</p><span className="ip-cinematic-type__rule"/><h2>Considered details. <em>Effortless wear.</em></h2><p className="ip-cinematic-type__sub">Jewellery made to become part of your everyday.</p></div></div>
   <div className="ip-cinematic-frame ip-frame-5"><img src="/images/hero-gsap44.webp" alt="" decoding="async"/><div className="green-veil"/><div className="hero-final"><p className="eyebrow">The Ivy Edit</p><h2>Jewellery, <em>held close.</em></h2><Link to="/the-ivy-edit/">Discover the collection ↗</Link></div></div>
   <div className="ip-cinematic-progress" aria-hidden="true"><span>01</span><div className="ip-cinematic-progress__track"><span className="ip-cinematic-progress__fill"/></div><span>05</span></div>
  </div>
 </section>
}
