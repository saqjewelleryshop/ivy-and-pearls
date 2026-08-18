import { Router } from 'express';
import Stripe from 'stripe';
import { handlePaymentSucceeded, handlePaymentFailed } from '../services/orders.js';

const router=Router();

router.post('/stripe', async(req,res)=>{
  try{
    if(!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET) throw new Error('Stripe webhook credentials are not configured.');
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig=req.headers['stripe-signature'];
    const event=stripe.webhooks.constructEvent(req.body,sig,process.env.STRIPE_WEBHOOK_SECRET);
    if(event.type==='payment_intent.succeeded')await handlePaymentSucceeded(event.data.object);
    if(event.type==='payment_intent.payment_failed')await handlePaymentFailed(event.data.object);
    res.json({received:true});
  }catch(e){
    console.error('Stripe webhook error:',e.message);
    res.status(400).send(`Webhook Error: ${e.message}`);
  }
});

export default router;
