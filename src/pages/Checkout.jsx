import React,{useEffect,useMemo,useState} from 'react';
import {Elements,PaymentElement,useElements,useStripe} from '@stripe/react-stripe-js';
import {loadStripe} from '@stripe/stripe-js';
import {useCart} from '../context/CartContext';
import {useAuth} from '../context/AuthContext';
import {api} from '../lib/api';
import {money} from '../lib/format';
import Seo from '../components/Seo';

const stripePromise=import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY):null;

function PaymentStep({orderNumber,onPaid}){const stripe=useStripe(),elements=useElements();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function pay(e){e.preventDefault();if(!stripe||!elements)return;setBusy(true);setError('');const {error}=await stripe.confirmPayment({elements,confirmParams:{return_url:`${window.location.origin}/order-confirmed/?order=${encodeURIComponent(orderNumber)}`}});if(error){setError(error.message);setBusy(false)}else onPaid?.();}
 return <form onSubmit={pay} className="payment-form"><PaymentElement/><button className="button button--dark" disabled={!stripe||busy}>{busy?'Processing…':'Pay securely'}</button>{error&&<p className="form-error" role="alert">{error}</p>}</form>}

export default function Checkout(){
 const cart=useCart(),{user,session}=useAuth();const [step,setStep]=useState('details'),[clientSecret,setClientSecret]=useState(''),[orderNumber,setOrderNumber]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const subtotal=useMemo(()=>cart.items.reduce((s,i)=>s+i.variant.price_minor*i.quantity,0),[cart.items]);
 const [form,setForm]=useState({email:user?.email||'',first_name:'',last_name:'',phone:'',address1:'',address2:'',city:'',province:'',postcode:'',country_code:'GB',customerNote:'',consent:false});
 useEffect(()=>{if(user?.email)setForm(f=>({...f,email:user.email}))},[user?.email]);
 function field(name){return {value:form[name],onChange:e=>setForm(f=>({...f,[name]:e.target.type==='checkbox'?e.target.checked:e.target.value}))}}
 async function createIntent(e){e.preventDefault();setBusy(true);setError('');try{
  const shippingAddress={first_name:form.first_name,last_name:form.last_name,phone:form.phone,address1:form.address1,address2:form.address2||null,city:form.city,province:form.province,postcode:form.postcode,country_code:'GB'};
  const result=await api('/checkout/payment-intent',{method:'POST',headers:session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{},body:JSON.stringify({email:form.email,items:cart.items.map(i=>({variantId:i.variant.id,quantity:i.quantity})),shippingAddress,customerNote:form.customerNote})});
  setClientSecret(result.clientSecret);setOrderNumber(result.orderNumber);setStep('payment');
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 if(!cart.items.length&&step==='details')return <><Seo title="Checkout" description="Secure checkout for Ivy & Pearls." path="/checkout/" noindex/><section className="section container empty-state"><h1>Your bag is empty.</h1><p>Add a piece before continuing to checkout.</p></section></>;
 return <><Seo title="Checkout" description="Secure checkout for Ivy & Pearls." path="/checkout/" noindex/><section className="checkout"><div className="checkout__main"><p className="eyebrow">Secure checkout</p><h1>{step==='details'?'Delivery details':'Payment'}</h1>
 {step==='details'?<form className="checkout-form" onSubmit={createIntent}><div className="form-grid"><label>Email<input type="email" required {...field('email')}/></label><label>Phone<input required {...field('phone')}/></label><label>First name<input required {...field('first_name')}/></label><label>Last name<input required {...field('last_name')}/></label><label className="span-2">Address<input required {...field('address1')}/></label><label className="span-2">Address line 2<input {...field('address2')}/></label><label>Town / city<input required {...field('city')}/></label><label>County<input required {...field('province')}/></label><label>Postcode<input required {...field('postcode')}/></label><label>Country<select value="GB" disabled><option value="GB">United Kingdom</option></select></label><label className="span-2">Order note<textarea rows="3" {...field('customerNote')}/></label></div><button className="button button--dark" disabled={busy}>{busy?'Preparing payment…':'Continue to secure payment'}</button>{error&&<p className="form-error" role="alert">{error}</p>}</form>:
  stripePromise&&clientSecret?<Elements stripe={stripePromise} options={{clientSecret,appearance:{theme:'stripe',variables:{colorPrimary:'#0b3d2e',colorText:'#17271f',borderRadius:'0px'}}}}><PaymentStep orderNumber={orderNumber}/></Elements>:<p>Payment configuration is unavailable.</p>}
 </div><aside className="checkout__summary"><h2>Order summary</h2>{cart.items.map(i=><div className="checkout-line" key={i.variant.id}>{i.product.images?.[0]&&<img src={i.product.images[0].url} alt=""/>}<div><b>{i.product.title}</b><span>{i.variant.title} · Qty {i.quantity}</span></div><strong>{money(i.variant.price_minor*i.quantity)}</strong></div>)}<div className="checkout-totals"><p><span>Subtotal</span><b>{money(subtotal)}</b></p><p><span>UK delivery</span><b>Complimentary</b></p><p><span>Total</span><strong>{money(subtotal)}</strong></p></div></aside></section></>
}
