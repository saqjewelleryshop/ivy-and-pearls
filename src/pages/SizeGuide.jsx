import React from 'react';
import Seo from '../components/Seo';
import {Link} from 'react-router-dom';

export default function SizeGuide(){
  const ringRows=[['UK J','15.5 mm','48.7 mm'],['UK L','16.3 mm','51.2 mm'],['UK N','17.1 mm','53.8 mm'],['UK P','17.9 mm','56.3 mm'],['UK R','18.8 mm','59.0 mm'],['UK T','19.6 mm','61.6 mm']];
  return <><Seo title="Jewellery Size Guide" description="Find your Ivy & Pearls ring, necklace and bracelet size with our practical measuring guide." path="/size-guide/"/>
  <section className="page-hero page-hero--editorial"><div className="container"><p className="eyebrow">Client care</p><h1>Find your <em>perfect fit.</em></h1><p>A considered guide to ring, bracelet and necklace sizing, with simple at-home measuring advice.</p></div></section>
  <section className="guide-layout container">
    <aside className="guide-nav" aria-label="Size guide sections"><span>On this page</span><a href="#rings">Rings</a><a href="#bracelets">Bracelets</a><a href="#necklaces">Necklaces</a><a href="#tips">Measuring tips</a></aside>
    <article className="guide-content">
      <section id="rings"><p className="eyebrow">01 · Rings</p><h2>Measure a ring you already love.</h2><p>For the most reliable at-home result, choose a ring that fits the intended finger and measure its inside diameter straight across the centre. Compare that measurement with the table below. Ring sizing can vary slightly by profile and design, so use product-specific information where shown.</p>
      <div className="size-table-wrap"><table className="size-table"><thead><tr><th>UK size</th><th>Inside diameter</th><th>Inside circumference</th></tr></thead><tbody>{ringRows.map(r=><tr key={r[0]}>{r.map(c=><td key={c}>{c}</td>)}</tr>)}</tbody></table></div>
      <p className="guide-note">Between sizes? For wider bands, many clients prefer the roomier option. Fingers naturally change throughout the day, so avoid measuring when your hands are unusually cold or warm.</p></section>
      <section id="bracelets"><p className="eyebrow">02 · Bracelets</p><h2>Comfort should feel effortless.</h2><p>Wrap a soft tape around your wrist where you would naturally wear a bracelet. Note the snug wrist measurement, then add approximately 1–1.5 cm for a close fit or 1.5–2 cm for a more relaxed drape. For rigid bangles, measure across the widest part of your knuckles with your thumb folded into your palm.</p></section>
      <section id="necklaces"><p className="eyebrow">03 · Necklaces</p><h2>Choose your line and layer.</h2><div className="length-grid"><div><strong>40 cm</strong><span>Close to the base of the neck</span></div><div><strong>45 cm</strong><span>Classic everyday length</span></div><div><strong>50–55 cm</strong><span>Relaxed, ideal for layering</span></div><div><strong>60 cm+</strong><span>Longer statement proportion</span></div></div><p>Where a pendant sits depends on your height, neckline and body proportions. Use a ribbon cut to the stated chain length to preview the position before ordering.</p></section>
      <section id="tips"><p className="eyebrow">04 · Measuring well</p><h2>A few details make a difference.</h2><ul className="editorial-list"><li>Measure more than once and use millimetres for ring measurements.</li><li>Measure the exact finger or wrist you intend to wear the piece on.</li><li>Do not use an outer ring diameter; only the internal opening matters.</li><li>Check the individual product page for adjustable or fixed-size details.</li><li>If you are buying a gift and are unsure, Client Care can help you choose the safest option.</li></ul><div className="guide-cta"><p className="eyebrow">Still unsure?</p><h3>Let us help you choose.</h3><p>Send us the piece you are considering and any measurement you already have.</p><Link className="btn btn--dark" to="/contact/">Contact Client Care</Link></div></section>
    </article>
  </section></>;
}
