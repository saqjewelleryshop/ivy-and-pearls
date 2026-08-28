import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import { supabaseBrowser } from '../lib/supabase';

const C=createContext({user:null,session:null,loading:true});

export function AuthProvider({children}){
  const sb=useMemo(()=>supabaseBrowser(),[]);
  const [session,setSession]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!sb){setLoading(false);return;}
    sb.auth.getSession().then(({data})=>{setSession(data.session||null);setLoading(false);});
    const {data:{subscription}}=sb.auth.onAuthStateChange((_event,next)=>{setSession(next);setLoading(false);});
    return()=>subscription.unsubscribe();
  },[sb]);
  const value={
    user:session?.user||null,session,loading,supabase:sb,
    signOut:()=>sb?.auth.signOut()
  };
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useAuth=()=>useContext(C);
