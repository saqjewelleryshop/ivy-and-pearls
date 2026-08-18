import { supabaseAdmin } from '../lib/supabase.js';
import { getProductsByVariantIds } from './catalog.js';
import { zq } from '../lib/zq.js';
import { sendEmail, orderConfirmationHtml, dispatchHtml } from './email.js';
import { stripeClientForCurrentMode } from './stripe-products.js';


export function createOrderNumber() {
  const d=new Date();
  const y=String(d.getUTCFullYear()).slice(-2);
  const m=String(d.getUTCMonth()+1).padStart(2,'0');
  const day=String(d.getUTCDate()).padStart(2,'0');
  const rand=Math.random().toString(36).slice(2,7).toUpperCase();
  return `IP-${y}${m}${day}-${rand}`;
}

function imageForVariant(v) {
  const imgs=[...(v.product_images||[])].sort((a,b)=>Number(b.is_primary)-Number(a.is_primary)||a.sort_order-b.sort_order);
  return imgs[0]?.url || null;
}

export async function priceCart(items, discountCode) {
  if(!Array.isArray(items) || !items.length) throw new Error('Your bag is empty.');
  const clean=items.map(i=>({variantId:String(i.variantId||''),quantity:Math.max(1,Math.min(10,Number(i.quantity)||1))}));
  const variants=await getProductsByVariantIds([...new Set(clean.map(i=>i.variantId))]);
  const map=new Map(variants.map(v=>[v.id,v]));
  const lines=clean.map(i=>{
    const v=map.get(i.variantId);
    if(!v) throw new Error('A product in your bag is no longer available.');
    if(v.inventory_quantity < i.quantity) throw new Error(`${v.products.title} does not have enough stock available.`);
    return {
      product_id:v.product_id, variant_id:v.id, product_name:v.products.title, variant_name:v.title,
      sku:v.sku, zq_sku:v.zq_sku, product_image:imageForVariant(v), quantity:i.quantity,
      unit_price_minor:v.price_minor, line_total_minor:v.price_minor*i.quantity, weight_kg:Number(v.weight_kg||0)
    };
  });
  const subtotal=lines.reduce((s,l)=>s+l.line_total_minor,0);
  let discount=0, appliedCode=null;
  if(discountCode){
    const db=supabaseAdmin();
    const {data}=await db.from('discount_codes').select('*').ilike('code',discountCode.trim()).eq('active',true).maybeSingle();
    const now=Date.now();
    if(data && subtotal>=data.minimum_minor && (!data.starts_at||new Date(data.starts_at).getTime()<=now) &&
      (!data.ends_at||new Date(data.ends_at).getTime()>=now) && (!data.max_uses||data.uses<data.max_uses)){
      discount=data.type==='percent'?Math.floor(subtotal*(data.value/100)):Math.min(subtotal,data.value);
      appliedCode=data;
    }
  }
  const shipping=0; // Ivy & Pearls policy: complimentary UK delivery.
  return {lines,subtotal,shipping,discount,total:Math.max(0,subtotal+shipping-discount),appliedCode};
}

export async function createPayment({items,email,shippingAddress,billingAddress,customerNote,discountCode,userId}) {
  if(String(shippingAddress?.country_code||'').toUpperCase()!=='GB') {
    const err=new Error('Online checkout currently supports UK delivery addresses.');
    err.status=400; throw err;
  }
  const priced=await priceCart(items,discountCode);
  const { stripe, runtime }=await stripeClientForCurrentMode();
  if(!runtime.settings.enabled) throw Object.assign(new Error('Payments are currently disabled.'),{status:503});
  const minimum=Number(runtime.settings.minimum_order_minor??50);
  if(priced.total < minimum) throw new Error('Order total is below the minimum payment amount.');
  const db=supabaseAdmin();
  const orderNumber=createOrderNumber();
  const {data:order,error}=await db.from('orders').insert({
    order_number:orderNumber,user_id:userId||null,email,status:'pending_payment',currency:'GBP',
    subtotal_minor:priced.subtotal,shipping_minor:priced.shipping,discount_minor:priced.discount,total_minor:priced.total,
    shipping_address:shippingAddress,billing_address:billingAddress||shippingAddress,customer_note:customerNote||null
  }).select().single();
  if(error) throw error;
  const {error:itemError}=await db.from('order_items').insert(priced.lines.map(l=>({...l,order_id:order.id})));
  if(itemError) throw itemError;
  const intent=await stripe.paymentIntents.create({
    amount:priced.total,currency:String(runtime.settings.currency||'GBP').toLowerCase(),
    automatic_payment_methods:{enabled:Boolean(runtime.settings.automatic_payment_methods)},
    ...(runtime.settings.receipt_emails?{receipt_email:email}:{}),
    metadata:{ivy_order_id:order.id,ivy_order_number:orderNumber}
  },{idempotencyKey:`ivy-payment-${order.id}`});
  await db.from('orders').update({stripe_payment_intent_id:intent.id}).eq('id',order.id);
  await db.from('order_events').insert({order_id:order.id,event_type:'payment_intent_created',detail:{payment_intent_id:intent.id}});
  return {orderId:order.id,orderNumber,clientSecret:intent.client_secret,amount:priced.total,currency:'GBP'};
}

export async function loadOrderFull(orderId) {
  const db=supabaseAdmin();
  const {data,error}=await db.from('orders').select('*,order_items(*)').eq('id',orderId).maybeSingle();
  if(error) throw error;
  if(!data) return null;
  return {...data,items:data.order_items||[],order_items:undefined};
}

export async function submitOrderToZq(orderId) {
  const db=supabaseAdmin();
  const order=await loadOrderFull(orderId);
  if(!order) throw new Error('Order not found.');
  if(order.zq_platform_order_id) return order;
  if(!['paid','fulfilment_pending','fulfilment_error'].includes(order.status)) throw new Error('Order is not ready for fulfilment.');
  const a=order.shipping_address;
  const payload={
    orderNumber:order.order_number,
    countryCode:String(a.country_code||'GB').toUpperCase(),
    city:a.city,
    province:a.province||a.city,
    postCode:a.postcode,
    consignee:`${a.first_name} ${a.last_name}`.trim(),
    addressDetail:a.address1,
    ...(a.address2?{address2:a.address2}:{}),
    ...(a.phone?{phone1:a.phone}:{}),
    email:order.email,
    amount:order.total_minor,
    commodities:order.items.map(i=>({
      sku:i.zq_sku,
      productName:i.product_name,
      variant:i.variant_name,
      quantity:i.quantity,
      amount:i.unit_price_minor,
      ...(i.product_image?{productImgUrls:[i.product_image]}:{})
    }))
  };
  await db.from('orders').update({status:'fulfilment_pending'}).eq('id',order.id);
  try{
    const result=await zq.createOrder(payload);
    const platformOrderId=result?.platformOrderIds?.[0];
    if(!platformOrderId) throw new Error('ZQ did not return a platform order ID.');
    await db.from('orders').update({
      status:'submitted_to_zq',zq_platform_order_id:platformOrderId,submitted_to_zq_at:new Date().toISOString()
    }).eq('id',order.id);
    await db.from('order_events').insert({order_id:order.id,event_type:'submitted_to_zq',detail:{platformOrderId,result}});
    return await loadOrderFull(order.id);
  }catch(error){
    await db.from('orders').update({status:'fulfilment_error'}).eq('id',order.id);
    await db.from('order_events').insert({order_id:order.id,event_type:'zq_submission_failed',detail:{message:error.message}});
    throw error;
  }
}

export async function handlePaymentSucceeded(paymentIntent) {
  const db=supabaseAdmin();
  const {data:order,error}=await db.from('orders').select('id,status').eq('stripe_payment_intent_id',paymentIntent.id).maybeSingle();
  if(error||!order) throw error||new Error('Order for payment was not found.');
  if(order.status!=='pending_payment') return;
  await db.from('orders').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',order.id);
  await db.from('order_events').insert({order_id:order.id,event_type:'payment_succeeded',detail:{payment_intent_id:paymentIntent.id}});
  const full=await loadOrderFull(order.id);
  await sendEmail({to:full.email,subject:`Order ${full.order_number} confirmed`,html:orderConfirmationHtml(full)}).catch(console.error);
  await submitOrderToZq(order.id);
}

export async function handlePaymentFailed(paymentIntent) {
  const db=supabaseAdmin();
  const {data:order}=await db.from('orders').select('id').eq('stripe_payment_intent_id',paymentIntent.id).maybeSingle();
  if(order) await db.from('order_events').insert({order_id:order.id,event_type:'payment_failed',detail:{payment_intent_id:paymentIntent.id}});
}

export async function syncZqOrder(order) {
  if(!order.zq_platform_order_id) return null;
  const db=supabaseAdmin();
  const [detail,tracking]=await Promise.all([
    zq.getOrderDetail(order.zq_platform_order_id).catch(()=>null),
    zq.getTracking(order.zq_platform_order_id).catch(()=>null)
  ]);
  const track=tracking?.trackNumber || detail?.trackNumber || null;
  const domestic=tracking?.trackNumber1 || detail?.trackNumber1 || null;
  const zqStatus=detail?.status || order.zq_status;
  let status=order.status;
  if(track && !['cancelled','refunded','delivered'].includes(status)) status='shipped';
  else if(['PAID','PROCESSING','SUCCESS'].includes(zqStatus) && !['shipped','delivered'].includes(status)) status='processing';
  const changed=track && !order.tracking_number;
  await db.from('orders').update({
    zq_status:zqStatus||null,status,tracking_number:track,domestic_tracking_number:domestic,
    ...(changed?{shipped_at:new Date().toISOString()}:{})
  }).eq('id',order.id);
  if(changed){
    await db.from('order_events').insert({order_id:order.id,event_type:'tracking_received',detail:{trackNumber:track,trackNumber1:domestic}});
    const full=await loadOrderFull(order.id);
    await sendEmail({to:full.email,subject:`Your order ${full.order_number} is on its way`,html:dispatchHtml(full)}).catch(console.error);
  }
  return {detail,tracking,status};
}

export async function syncOpenZqOrders() {
  const db=supabaseAdmin();
  const {data,error}=await db.from('orders').select('*').not('zq_platform_order_id','is',null)
    .in('status',['submitted_to_zq','processing','shipped']).order('updated_at',{ascending:true}).limit(100);
  if(error) throw error;
  const results=[];
  for(const order of data||[]){
    try{results.push({order:order.order_number,ok:true,result:await syncZqOrder(order)});}
    catch(e){results.push({order:order.order_number,ok:false,error:e.message});}
  }
  return results;
}
