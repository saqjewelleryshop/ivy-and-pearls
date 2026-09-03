import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
const C=createContext(null);
const KEY='ivy_cart_v2';

export function CartProvider({children}){
  const [items,setItems]=useState([]);
  const [open,setOpen]=useState(false);
  useEffect(()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(x))setItems(x);}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(items));}catch{}},[items]);
  const api=useMemo(()=>({
    items,open,setOpen,
    count:items.reduce((s,i)=>s+i.quantity,0),
    add(product,variant,quantity=1){
      setItems(prev=>{
        const hit=prev.find(i=>i.variant.id===variant.id);
        if(hit)return prev.map(i=>i.variant.id===variant.id?{...i,quantity:Math.min(10,i.quantity+quantity)}:i);
        return [...prev,{product:{id:product.id,slug:product.slug,title:product.title,images:product.images},variant,quantity}];
      });setOpen(true);
    },
    setQty(id,quantity){setItems(prev=>quantity<=0?prev.filter(i=>i.variant.id!==id):prev.map(i=>i.variant.id===id?{...i,quantity:Math.min(10,quantity)}:i));},
    remove(id){setItems(prev=>prev.filter(i=>i.variant.id!==id));},
    clear(){setItems([]);}
  }),[items,open]);
  return <C.Provider value={api}>{children}</C.Provider>
}
export const useCart=()=>useContext(C);
