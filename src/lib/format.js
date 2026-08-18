export const money=(minor=0,currency='GBP')=>new Intl.NumberFormat('en-GB',{style:'currency',currency}).format((Number(minor)||0)/100);
export const date=(value)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value));
export const slugify=(s='')=>s.toLowerCase().trim().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
