import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

export default function ScrollToTop(){
  const {pathname}=useLocation();

  useEffect(()=>{
    const root=document.documentElement;
    const previous=root.style.scrollBehavior;
    root.style.scrollBehavior='auto';
    window.scrollTo(0,0);
    const frame=requestAnimationFrame(()=>{
      root.style.scrollBehavior=previous;
    });
    return()=>cancelAnimationFrame(frame);
  },[pathname]);

  return null;
}
