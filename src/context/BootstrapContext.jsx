import React,{createContext,useContext} from 'react';
const C=createContext({});
export function BootstrapProvider({value,children}){return <C.Provider value={value||{}}>{children}</C.Provider>}
export const useBootstrap=()=>useContext(C);
