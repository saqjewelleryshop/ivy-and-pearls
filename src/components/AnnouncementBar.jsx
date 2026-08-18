import React,{useEffect,useState} from 'react';
import { HOME } from '../lib/content';
import { Link } from 'react-router-dom';

export default function AnnouncementBar(){
  const [i,setI]=useState(0);
  useEffect(()=>{const id=setInterval(()=>setI(v=>(v+1)%HOME.announcements.length),4500);return()=>clearInterval(id)},[]);
  return <div className="announcement" role="region" aria-label="Store announcements">
    <div className="announcement__message" key={i}>{HOME.announcements[i]}</div>
    <Link to="/contact/">Client care ↗</Link>
  </div>
}
