import { Router } from 'express';
import { z } from 'zod';
import { sensitiveLimiter } from '../middleware/security.js';
import { supabaseAdmin, getUserFromRequest, requireUser, requireAdmin } from '../lib/supabase.js';
import { listProducts, getProductBySlug, listJournal, getJournalPost, syncZqInventory } from '../services/catalog.js';
import { createPayment, loadOrderFull, submitOrderToZq, syncOpenZqOrders } from '../services/orders.js';
import { zq } from '../lib/zq.js';
import { sendEmail } from '../services/email.js';
import sanitizeHtml from 'sanitize-html';

const router=Router();

const addressSchema=z.object({
  first_name:z.string().min(1).max(80),
  last_name:z.string().min(1).max(80),
  company:z.string().max(120).optional().nullable(),
  address1:z.string().min(3).max(180),
  address2:z.string().max(180).optional().nullable(),
  city:z.string().min(1).max(100),
  province:z.string().min(1).max(100),
  postcode:z.string().min(2).max(20),
  country_code:z.string().length(2),
  phone:z.string().max(40).optional().nullable()
});

router.get('/health', (req,res)=>res.json({ok:true,service:'ivy-pearls-api'}));

router.get('/products', async (req,res,next)=>{
  try{
    const products=await listProducts({
      category:req.query.category||undefined,
      collection:req.query.collection||undefined,
      ivyEdit:req.query.ivy==='1',
      newArrival:req.query.new==='1',
      featured:req.query.featured==='1',
      search:req.query.q||undefined,
      limit:Number(req.query.limit||24),
      offset:Number(req.query.offset||0)
    });
    res.json({products});
  }catch(e){next(e);}
});

router.get('/products/:slug', async (req,res,next)=>{
  try{
    const product=await getProductBySlug(req.params.slug);
    if(!product) return res.status(404).json({error:'Product not found.'});
    res.json({product});
  }catch(e){next(e);}
});

router.get('/journal', async(req,res,next)=>{
  try{res.json({posts:await listJournal()});}catch(e){next(e);}
});
router.get('/journal/:slug', async(req,res,next)=>{
  try{
    const post=await getJournalPost(req.params.slug);
    if(!post)return res.status(404).json({error:'Article not found.'});
    res.json({post});
  }catch(e){next(e);}
});

router.post('/newsletter', sensitiveLimiter, async(req,res,next)=>{
  try{
    const body=z.object({email:z.string().email(),consent:z.literal(true)}).parse(req.body);
    const db=supabaseAdmin();
    const {error}=await db.from('newsletter_subscribers').upsert({
      email:body.email.toLowerCase(),consent:true,unsubscribed_at:null,subscribed_at:new Date().toISOString()
    },{onConflict:'email'});
    if(error)throw error;
    res.status(201).json({ok:true});
  }catch(e){next(e);}
});

router.post('/contact', sensitiveLimiter, async(req,res,next)=>{
  try{
    const body=z.object({
      name:z.string().min(2).max(120),email:z.string().email(),orderNumber:z.string().max(40).optional(),
      topic:z.enum(['Product question','Order support','Returns','Press & partnerships','Other']),
      message:z.string().min(10).max(4000)
    }).parse(req.body);
    const db=supabaseAdmin();
    const {error}=await db.from('contact_messages').insert({
      name:body.name,email:body.email,order_number:body.orderNumber||null,topic:body.topic,message:body.message
    });
    if(error)throw error;
    await sendEmail({
      to:process.env.CLIENT_CARE_EMAIL||'clientcare@ivyandpearls.co.uk',
      subject:`Client care: ${body.topic}`,
      html:`<p><strong>${body.name}</strong> (${body.email})</p><p>Order: ${body.orderNumber||'—'}</p><p>${body.message.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p>`
    }).catch(console.error);
    res.status(201).json({ok:true});
  }catch(e){next(e);}
});

router.post('/checkout/payment-intent', sensitiveLimiter, async(req,res,next)=>{
  try{
    const body=z.object({
      email:z.string().email(),
      items:z.array(z.object({variantId:z.string().uuid(),quantity:z.number().int().min(1).max(10)})).min(1).max(30),
      shippingAddress:addressSchema,
      billingAddress:addressSchema.optional(),
      customerNote:z.string().max(500).optional(),
      discountCode:z.string().max(40).optional()
    }).parse(req.body);
    const user=await getUserFromRequest(req);
    const result=await createPayment({
      items:body.items,email:body.email,shippingAddress:body.shippingAddress,
      billingAddress:body.billingAddress,customerNote:body.customerNote,discountCode:body.discountCode,userId:user?.id
    });
    res.status(201).json(result);
  }catch(e){next(e);}
});

router.get('/orders/:orderNumber', requireUser, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const {data,error}=await db.from('orders').select('id,user_id').eq('order_number',req.params.orderNumber).maybeSingle();
    if(error)throw error;
    if(!data||data.user_id!==req.user.id)return res.status(404).json({error:'Order not found.'});
    const order=await loadOrderFull(data.id);
    res.json({order});
  }catch(e){next(e);}
});

router.get('/account/orders', requireUser, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const {data,error}=await db.from('orders').select('id,order_number,status,total_minor,currency,created_at,tracking_number')
      .eq('user_id',req.user.id).order('created_at',{ascending:false});
    if(error)throw error;
    res.json({orders:data||[]});
  }catch(e){next(e);}
});

router.get('/account/addresses', requireUser, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const {data,error}=await db.from('addresses').select('*').eq('user_id',req.user.id).order('is_default',{ascending:false});
    if(error)throw error;res.json({addresses:data||[]});
  }catch(e){next(e);}
});
router.post('/account/addresses', requireUser, async(req,res,next)=>{
  try{
    const body=addressSchema.extend({label:z.string().min(1).max(30).default('Delivery'),is_default:z.boolean().default(false)}).parse(req.body);
    const db=supabaseAdmin();
    if(body.is_default)await db.from('addresses').update({is_default:false}).eq('user_id',req.user.id);
    const {data,error}=await db.from('addresses').insert({...body,user_id:req.user.id}).select().single();
    if(error)throw error;res.status(201).json({address:data});
  }catch(e){next(e);}
});
router.delete('/account/addresses/:id', requireUser, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const {error}=await db.from('addresses').delete().eq('id',req.params.id).eq('user_id',req.user.id);
    if(error)throw error;res.json({ok:true});
  }catch(e){next(e);}
});

router.get('/admin/dashboard', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const [{count:products},{count:orders},{count:contacts},{data:recent}]=await Promise.all([
      db.from('products').select('*',{count:'exact',head:true}),
      db.from('orders').select('*',{count:'exact',head:true}),
      db.from('contact_messages').select('*',{count:'exact',head:true}).eq('status','new'),
      db.from('orders').select('order_number,status,total_minor,created_at').order('created_at',{ascending:false}).limit(8)
    ]);
    res.json({products,orders,newMessages:contacts,recentOrders:recent||[]});
  }catch(e){next(e);}
});

router.get('/admin/orders', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    let q=db.from('orders').select('*,order_items(*)').order('created_at',{ascending:false}).limit(100);
    if(req.query.status)q=q.eq('status',req.query.status);
    const {data,error}=await q;if(error)throw error;res.json({orders:data||[]});
  }catch(e){next(e);}
});
router.post('/admin/orders/:id/retry-zq', requireAdmin, async(req,res,next)=>{
  try{res.json({order:await submitOrderToZq(req.params.id)});}catch(e){next(e);}
});

router.get('/admin/zq/products', requireAdmin, async(req,res,next)=>{
  try{
    const data=await zq.listImportProducts({cursor:req.query.cursor?Number(req.query.cursor):null,size:20,keyword:req.query.q||undefined,status:'PUBLISHED'});
    res.json(data);
  }catch(e){next(e);}
});
router.get('/admin/zq/products/:id', requireAdmin, async(req,res,next)=>{
  try{res.json({product:await zq.getImportProduct(req.params.id)});}catch(e){next(e);}
});

router.post('/admin/zq/import/:id', requireAdmin, async(req,res,next)=>{
  try{
    const config=z.object({
      title:z.string().min(2).max(180),slug:z.string().regex(/^[a-z0-9-]+$/),category:z.enum(['rings','necklaces','earrings','bracelets']),
      collection:z.string().max(120).optional(),retailPricePounds:z.number().min(1).max(100000),
      shortDescription:z.string().max(500).default(''),description:z.string().max(20000).default(''),
      materialSummary:z.string().max(1000).default(''),active:z.boolean().default(false)
    }).parse(req.body);
    const zqp=await zq.getImportProduct(req.params.id);
    const db=supabaseAdmin();
    const {data:product,error}=await db.from('products').insert({
      slug:config.slug,title:config.title,short_description:config.shortDescription,
      description:sanitizeHtml(config.description||zqp.description||'',{allowedTags:['p','br','strong','em','ul','ol','li','h2','h3'],allowedAttributes:{}}),category:config.category,collection:config.collection||null,
      material_summary:config.materialSummary,status:config.active?'active':'draft',
      seo_title:`${config.title} | Ivy & Pearls`,
      seo_description:config.shortDescription||`Discover ${config.title} from Ivy & Pearls.`,
      published_at:config.active?new Date().toISOString():null
    }).select().single();
    if(error)throw error;
    const specs=(zqp.specs||[]).filter(s=>s.status==='PUBLISHED');
    const variants=specs.map((s,i)=>{
      const retail=Math.round(config.retailPricePounds*100);
      return {
        product_id:product.id,sku:`IP-${product.slug.toUpperCase().slice(0,12)}-${i+1}`,zq_sku:s.skuId,
        zq_product_id:zqp.id,zq_spec_id:s.id,title:s.spec||`Option ${i+1}`,
        attributes:Object.fromEntries((s.attributes||[]).map(a=>[a.attributeId,a.value])),
        price_minor:retail,cost_minor:Number(s.cost||0),cost_currency:zqp.targetCurrency||null,currency:'GBP',weight_kg:Number(s.weight||0),
        inventory_quantity:Number(s.amountOnSale||0),active:true,sort_order:i
      };
    });
    if(variants.length){
      const {error:ve}=await db.from('product_variants').insert(variants);if(ve)throw ve;
    }
    const imgs=(zqp.images||[]).map((im,i)=>({
      product_id:product.id,url:im.image,alt_text:`${config.title}${i?` – view ${i+1}`:''}`,
      sort_order:i,is_primary:Boolean(im.isMain)||i===0
    }));
    if(imgs.length){const {error:ie}=await db.from('product_images').insert(imgs);if(ie)throw ie;}
    res.status(201).json({productId:product.id,slug:product.slug});
  }catch(e){next(e);}
});

router.get('/admin/products', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();const {data,error}=await db.from('products').select('*,product_variants(*),product_images(*)').order('created_at',{ascending:false});
    if(error)throw error;res.json({products:data||[]});
  }catch(e){next(e);}
});
router.patch('/admin/products/:id', requireAdmin, async(req,res,next)=>{
  try{
    const allowed=z.object({
      title:z.string().min(2).max(180).optional(),slug:z.string().regex(/^[a-z0-9-]+$/).optional(),
      short_description:z.string().max(500).optional(),description:z.string().max(20000).optional(),
      material_summary:z.string().max(1000).optional(),care:z.string().max(3000).optional(),
      category:z.enum(['rings','necklaces','earrings','bracelets']).optional(),collection:z.string().max(120).nullable().optional(),
      status:z.enum(['draft','active','archived']).optional(),featured:z.boolean().optional(),ivy_edit:z.boolean().optional(),
      new_arrival:z.boolean().optional(),seo_title:z.string().max(180).optional(),seo_description:z.string().max(320).optional()
    }).parse(req.body);
    const db=supabaseAdmin();const patch={...allowed};
    if(allowed.status==='active')patch.published_at=new Date().toISOString();
    const {data,error}=await db.from('products').update(patch).eq('id',req.params.id).select().single();
    if(error)throw error;res.json({product:data});
  }catch(e){next(e);}
});
router.patch('/admin/variants/:id', requireAdmin, async(req,res,next)=>{
  try{
    const body=z.object({
      title:z.string().max(120).optional(),price_minor:z.number().int().min(0).optional(),
      compare_at_minor:z.number().int().min(0).nullable().optional(),active:z.boolean().optional()
    }).parse(req.body);
    const db=supabaseAdmin();const {data,error}=await db.from('product_variants').update(body).eq('id',req.params.id).select().single();
    if(error)throw error;res.json({variant:data});
  }catch(e){next(e);}
});

router.get('/cron/zq-sync', async(req,res,next)=>{
  try{
    if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
    const [orders,inventory]=await Promise.all([syncOpenZqOrders(),syncZqInventory(zq)]);res.json({orders,inventory});
  }catch(e){next(e);}
});

export default router;
