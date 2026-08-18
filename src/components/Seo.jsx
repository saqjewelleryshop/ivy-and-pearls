import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE } from '../lib/config';

export default function Seo({title,description,path='/',canonicalUrl,image='/images/social-share.webp',ogTitle,ogDescription,jsonLd,noindex=false,robots,type='website'}){
  const fullTitle=title?(title.includes(SITE.name)?title:`${title} | ${SITE.name}`):`${SITE.name} | Contemporary Jewellery`;
  const canonical=canonicalUrl||new URL(path,SITE.url).toString();
  const imageUrl=new URL(image||'/images/social-share.webp',SITE.url).toString();
  const robotsValue=noindex?'noindex,nofollow':(robots||'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
  return <Helmet>
    <html lang="en-GB"/>
    <title>{fullTitle}</title>
    <meta name="description" content={description}/>
    <link rel="canonical" href={canonical}/>
    <meta name="robots" content={robotsValue}/>
    <meta property="og:locale" content="en_GB"/>
    <meta property="og:type" content={type}/>
    <meta property="og:site_name" content={SITE.name}/>
    <meta property="og:title" content={ogTitle||fullTitle}/>
    <meta property="og:description" content={ogDescription||description}/>
    <meta property="og:url" content={canonical}/>
    <meta property="og:image" content={imageUrl}/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content={ogTitle||fullTitle}/>
    <meta name="twitter:description" content={ogDescription||description}/>
    <meta name="twitter:image" content={imageUrl}/>
    {jsonLd&&<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
  </Helmet>;
}
