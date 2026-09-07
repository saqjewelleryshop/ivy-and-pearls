import React,{useEffect} from 'react';

export default function ChatWidget(){
  useEffect(()=>{
    const bot=import.meta.env.VITE_ZOCHAT_BOT_ID;
    if(!bot)return;

    const mobileQuery=window.matchMedia('(max-width: 800px)');
    if(mobileQuery.matches)return;

    let timer;
    let observer;

    const cleanupWidget=()=>{
      observer?.disconnect();
      document.querySelector(`script[data-chatbot="${bot}"]`)?.remove();
      document.querySelector(`#zochat-${bot}`)?.remove();
    };

    const load=()=>{
      if(mobileQuery.matches||document.querySelector('script[data-chatbot]'))return;

      const s=document.createElement('script');
      s.async=true;
      s.src='https://woo-chat-bot-widget.netlify.app/widget.js';
      s.dataset.chatbot=bot;
      document.body.appendChild(s);

      observer=new MutationObserver(()=>{
        if(mobileQuery.matches){
          cleanupWidget();
          return;
        }

        const host=document.querySelector(`#zochat-${bot}`);
        if(!host?.shadowRoot)return;

        const b=host.shadowRoot.querySelector('button[aria-label="Open chat"]');
        if(b){
          b.style.cssText+=';width:52px!important;height:52px!important;border-radius:50%!important;background:#0b3d2e!important;color:#f7f3eb!important;border:1px solid #c5a15a!important;box-shadow:0 8px 26px rgba(0,0,0,.16)!important';
          observer.disconnect();
        }
      });

      observer.observe(document.documentElement,{childList:true,subtree:true});
    };

    const onViewportChange=(event)=>{
      if(event.matches)cleanupWidget();
      else load();
    };

    mobileQuery.addEventListener?.('change',onViewportChange);

    if('requestIdleCallback' in window)timer=requestIdleCallback(load,{timeout:5000});
    else timer=setTimeout(load,3500);

    return()=>{
      if('cancelIdleCallback' in window&&typeof timer==='number')cancelIdleCallback(timer);
      else clearTimeout(timer);
      mobileQuery.removeEventListener?.('change',onViewportChange);
      observer?.disconnect();
    };
  },[]);

  return null;
}
