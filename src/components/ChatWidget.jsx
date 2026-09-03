import React,{useEffect} from 'react';
export default function ChatWidget(){useEffect(()=>{
 const bot=String(import.meta.env.VITE_ZOCHAT_BOT_ID||'').trim();
 const enabled=String(import.meta.env.VITE_ZOCHAT_ENABLED||'').toLowerCase()==='true';
 if(!enabled||!/^cb_[a-z0-9_-]+$/i.test(bot))return;
 let timer,observer;
 const load=()=>{if(document.querySelector('script[data-chatbot]'))return;const s=document.createElement('script');s.async=true;s.src='https://widget-omega-nine.vercel.app/widget.js';s.dataset.chatbot=bot;s.onerror=()=>console.warn('Client-care chat is temporarily unavailable.');document.body.appendChild(s);
  observer=new MutationObserver(()=>{const host=document.querySelector(`#zochat-${bot}`);if(!host?.shadowRoot)return;const b=host.shadowRoot.querySelector('button[aria-label="Open chat"]');if(b){b.style.cssText+=';width:52px!important;height:52px!important;border-radius:50%!important;background:#0b3d2e!important;color:#f7f3eb!important;border:1px solid #c5a15a!important;box-shadow:0 8px 26px rgba(0,0,0,.16)!important';observer.disconnect();}});observer.observe(document.documentElement,{childList:true,subtree:true});
 };
 if('requestIdleCallback'in window)timer=requestIdleCallback(load,{timeout:5000});else timer=setTimeout(load,3500);
 return()=>{if('cancelIdleCallback'in window&&typeof timer==='number')cancelIdleCallback(timer);else clearTimeout(timer);observer?.disconnect()}
 },[]);return null}
