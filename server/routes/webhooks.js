import { Router } from 'express';
import Stripe from 'stripe';
import { handlePaymentSucceeded, handlePaymentFailed } from '../services/orders.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { webhookSecrets } from '../services/stripe-products.js';

const router=Router();

function constructStripeEvent(rawBody, signature) {
  const candidates=webhookSecrets();
  if(!candidates.length) throw new Error('Stripe webhook credentials are not configured.');
  let lastError;
  for(const candidate of candidates){
    try{
      const stripe=new Stripe('sk_test_placeholder_for_webhook_verification');
      return {event:stripe.webhooks.constructEvent(rawBody,signature,candidate.secret),mode:candidate.mode};
    }catch(e){lastError=e;}
  }
  throw lastError||new Error('Stripe webhook signature could not be verified.');
}

router.post('/stripe', async(req,res)=>{
  let event;
  try{
    const sig=req.headers['stripe-signature'];
    if(!sig)throw new Error('Missing Stripe-Signature header.');
    ({event}=constructStripeEvent(req.body,sig));

    const db=supabaseAdmin();
    const {data:seen}=await db.from('stripe_webhook_events').select('id').eq('stripe_event_id',event.id).maybeSingle();
    if(seen)return res.json({received:true,duplicate:true});

    try{
      if(event.type==='payment_intent.succeeded')await handlePaymentSucceeded(event.data.object);
      if(event.type==='payment_intent.payment_failed')await handlePaymentFailed(event.data.object);
      await db.from('stripe_webhook_events').insert({stripe_event_id:event.id,event_type:event.type,livemode:Boolean(event.livemode),success:true});
    }catch(handlerError){
      await db.from('stripe_webhook_events').insert({stripe_event_id:event.id,event_type:event.type,livemode:Boolean(event.livemode),success:false,error_message:String(handlerError.message||handlerError).slice(0,2000)}).catch(()=>null);
      throw handlerError;
    }
    res.json({received:true});
  }catch(e){
    console.error('Stripe webhook error:',e.message);
    res.status(400).send(`Webhook Error: ${e.message}`);
  }
});

export default router;
