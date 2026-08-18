import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE } from '../lib/config';

export default function Seo({title,description,path='/',image='/images/social-share.webp',jsonLd,noindex=false,type='website'}){
  const fullTitle=title?(title.includes(SITE.name)?title:`${title} | ${SITE.name}`):`${SITE.name} | Contemporary Jewellery`;
  const canonical=new URL(path,SITE.url).toString();
  const imageUrl=new URL(image,SITE.url).toString();
  return <Helmet>
    <html lang="en-GB"/>
    <title>{fullTitle}</title>
    <meta name="description" content={description}/>
    <link rel="canonical" href={canonical}/>
    <meta name="robots" content={noindex?'noindex,nofollow':'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'}/>
    <meta property="og:locale" content="en_GB"/>
    <meta property="og:type" content={type}/>
    <meta property="og:site_name" content={SITE.name}/>
    <meta property="og:title" content={fullTitle}/>
    <meta property="og:description" content={description}/>
    <meta property="og:url" content={canonical}/>
    <meta property="og:image" content={imageUrl}/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content={fullTitle}/>
    <meta name="twitter:description" content={description}/>
    <meta name="twitter:image" content={imageUrl}/>
    {jsonLd&&<script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
  </Helmet>;
}
