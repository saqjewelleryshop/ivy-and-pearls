import { Router } from 'express';
import { z } from 'zod';
import { sensitiveLimiter } from '../middleware/security.js';
import { supabaseAdmin, getUserFromRequest, requireUser, requireAdmin } from '../lib/supabase.js';
import { listProducts, getProductBySlug, listJournal, getJournalPost, syncZqInventory } from '../services/catalog.js';
import { createPayment, loadOrderFull, submitOrderToZq, syncOpenZqOrders } from '../services/orders.js';
import { zq } from '../lib/zq.js';
import { sendEmail } from '../services/email.js';
import { getPaymentSettings, getStripeRuntimeConfig, configuredSecretsStatus, testStripeConnection, syncProductToStripe, setStripeProductActive } from '../services/stripe-products.js';
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

router.get('/stripe/config', async (req,res,next)=>{
  try{
    const runtime=await getStripeRuntimeConfig();
    res.json({
      enabled:Boolean(runtime.settings.enabled),
      mode:runtime.settings.mode,
      currency:runtime.settings.currency||'GBP',
      publishableKey:runtime.publishableKey||''
    });
  }catch(e){next(e);}
});

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
      material_summary:config.materialSummary,status:'needs_review',
      zq_product_id:Number(zqp.id),zq_source_status:zqp.status||null,zq_last_synced_at:new Date().toISOString(),zq_raw:zqp,
      seo_title:`${config.title} | Ivy & Pearls`,
      seo_description:config.shortDescription||`Discover ${config.title} from Ivy & Pearls.`,
      published_at:null
    }).select().single();
    if(error)throw error;
    const specs=(zqp.specs||[]).filter(s=>s.status==='PUBLISHED');
    const variants=specs.map((s,i)=>{
      const retail=Math.round(config.retailPricePounds*100);
      return {
        product_id:product.id,sku:`IP-${product.slug.toUpperCase().slice(0,12)}-${i+1}`,zq_sku:s.skuId,
        zq_product_id:zqp.id,zq_spec_id:s.id,title:s.spec||`Option ${i+1}`,
        attributes:Object.fromEntries((s.attributes||[]).map(a=>[String(a.attributeId),a.value])),supplier_title:s.spec||null,supplier_attributes:Object.fromEntries((s.attributes||[]).map(a=>[String(a.attributeId),a.value])),
        price_minor:retail,cost_minor:Math.round(Number(s.cost||0)*100),cost_currency:zqp.targetCurrency||null,currency:'GBP',weight_kg:Number(s.weight||0),
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
    if(config.active){
      try{
        await syncProductToStripe(product.id);
        const {error:pe}=await db.from('products').update({status:'active',published_at:new Date().toISOString()}).eq('id',product.id);
        if(pe)throw pe;
      }catch(stripeError){
        await db.from('products').update({status:'ready',stripe_sync_status:'error',stripe_sync_error:String(stripeError.message||stripeError).slice(0,2000)}).eq('id',product.id);
        return res.status(502).json({error:`Product imported but not published because Stripe sync failed: ${stripeError.message}`,productId:product.id,slug:product.slug});
      }
    }
    res.status(201).json({productId:product.id,slug:product.slug,status:config.active?'active':'needs_review'});
  }catch(e){next(e);}
});

router.get('/admin/products', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();const {data,error}=await db.from('products').select('*,product_variants(*),product_images(*)').order('created_at',{ascending:false});
    if(error)throw error;res.json({products:data||[]});
  }catch(e){next(e);}
});
router.get('/admin/catalogue-meta', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const [categories,collections,tags,attributes]=await Promise.all([
      db.from('categories').select('*').order('sort_order'),
      db.from('collections').select('*').order('sort_order'),
      db.from('tags').select('*').order('name'),
      db.from('attributes').select('*,attribute_values(*)').order('sort_order')
    ]);
    for(const r of [categories,collections,tags,attributes]) if(r.error) throw r.error;
    res.json({categories:categories.data||[],collections:collections.data||[],tags:tags.data||[],attributes:attributes.data||[]});
  }catch(e){next(e);}
});

router.post('/admin/catalogue-meta/:type', requireAdmin, async(req,res,next)=>{
  try{
    const map={categories:'categories',collections:'collections',tags:'tags',attributes:'attributes'};
    const table=map[req.params.type];
    if(!table)return res.status(404).json({error:'Unknown taxonomy.'});
    const base=z.object({name:z.string().min(1).max(120),slug:z.string().regex(/^[a-z0-9-]+$/)});
    const body=(table==='attributes'?base.extend({type:z.enum(['select','text','colour']).default('select')}):base).parse(req.body);
    const db=supabaseAdmin();const {data,error}=await db.from(table).insert(body).select().single();if(error)throw error;
    res.status(201).json({record:data});
  }catch(e){next(e);}
});

router.get('/admin/products/preview/:slug', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const {data,error}=await db.from('products').select(`
      *,product_variants(*),product_images(*)
    `).eq('slug',req.params.slug).maybeSingle();
    if(error)throw error;
    if(!data)return res.status(404).json({error:'Product not found.'});
    const product={
      ...data,
      variants:(data.product_variants||[]).filter(v=>v.active).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)),
      images:(data.product_images||[]).sort((a,b)=>Number(b.is_primary)-Number(a.is_primary)||(a.sort_order||0)-(b.sort_order||0))
    };
    delete product.product_variants;delete product.product_images;
    res.json({product});
  }catch(e){next(e);}
});

router.get('/admin/payments/stripe', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const settings=await getPaymentSettings();
    const {data:lastEvents,error}=await db.from('stripe_webhook_events').select('*').order('created_at',{ascending:false}).limit(10);
    if(error)throw error;
    res.json({settings,secrets:configuredSecretsStatus(),lastEvents:lastEvents||[]});
  }catch(e){next(e);}
});

router.patch('/admin/payments/stripe', requireAdmin, async(req,res,next)=>{
  try{
    const body=z.object({
      enabled:z.boolean().optional(),
      mode:z.enum(['test','live']).optional(),
      test_publishable_key:z.string().max(500).nullable().optional(),
      live_publishable_key:z.string().max(500).nullable().optional(),
      currency:z.string().length(3).transform(v=>v.toUpperCase()).optional(),
      automatic_payment_methods:z.boolean().optional(),
      receipt_emails:z.boolean().optional(),
      minimum_order_minor:z.number().int().min(0).optional(),
      statement_descriptor:z.string().max(22).nullable().optional(),
      confirmLive:z.string().optional()
    }).parse(req.body);
    if(body.mode==='live'&&body.confirmLive!=='LIVE')return res.status(400).json({error:'Type LIVE to confirm switching to live payments.'});
    delete body.confirmLive;
    const db=supabaseAdmin();
    const {data,error}=await db.from('payment_settings').update({...body,updated_at:new Date().toISOString()}).eq('id',1).select().single();
    if(error)throw error;
    res.json({settings:data,secrets:configuredSecretsStatus()});
  }catch(e){next(e);}
});

router.post('/admin/payments/stripe/test', requireAdmin, async(req,res,next)=>{
  try{res.json(await testStripeConnection());}catch(e){next(e);}
});

router.post('/admin/products/:id/sync-stripe', requireAdmin, async(req,res,next)=>{
  try{res.json({ok:true,result:await syncProductToStripe(req.params.id)});}catch(e){next(e);}
});

router.get('/admin/products/:id/detail', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const {data,error}=await db.from('products').select(`
      *,product_variants(*),product_images(*),product_attributes(*),
      product_categories(*,categories(*)),product_collections(*,collections(*)),product_tags(*,tags(*)),
      product_links!product_links_product_id_fkey(*),zq_sync_log(*)
    `).eq('id',req.params.id).single();
    if(error)throw error;res.json({product:data});
  }catch(e){next(e);}
});

router.patch('/admin/products/:id', requireAdmin, async(req,res,next)=>{
  try{
    const allowed=z.object({
      title:z.string().min(2).max(180).optional(),slug:z.string().regex(/^[a-z0-9-]+$/).optional(),subtitle:z.string().max(180).nullable().optional(),
      internal_sku:z.string().max(100).nullable().optional(),short_description:z.string().max(1000).optional(),description:z.string().max(30000).optional(),
      material_summary:z.string().max(2000).nullable().optional(),care:z.string().max(5000).nullable().optional(),origin_note:z.string().max(1000).nullable().optional(),
      category:z.enum(['rings','necklaces','earrings','bracelets']).optional(),collection:z.string().max(120).nullable().optional(),tags:z.array(z.string().max(80)).max(50).optional(),
      status:z.enum(['draft','needs_review','ready','active','archived','supplier_unavailable']).optional(),visibility:z.enum(['catalog_search','catalog','search','hidden']).optional(),product_type:z.enum(['simple','variable']).optional(),
      featured:z.boolean().optional(),ivy_edit:z.boolean().optional(),new_arrival:z.boolean().optional(),reviews_enabled:z.boolean().optional(),menu_order:z.number().int().optional(),
      seo_title:z.string().max(180).nullable().optional(),seo_description:z.string().max(320).nullable().optional(),canonical_url:z.string().max(500).nullable().optional(),
      og_title:z.string().max(180).nullable().optional(),og_description:z.string().max(320).nullable().optional(),og_image_url:z.string().max(1000).nullable().optional(),meta_robots:z.string().max(100).optional(),
      tax_class:z.string().max(80).optional(),country_of_origin:z.string().max(100).nullable().optional(),lead_time:z.string().max(200).nullable().optional(),dimensions:z.record(z.string(),z.any()).optional(),purchase_note:z.string().max(3000).nullable().optional(),custom_meta:z.record(z.string(),z.any()).optional(),
      sync_inventory:z.boolean().optional(),sync_cost:z.boolean().optional(),sync_weight:z.boolean().optional(),sync_supplier_status:z.boolean().optional(),sync_images:z.boolean().optional()
    }).parse(req.body);
    const db=supabaseAdmin();const patch={...allowed};
    if(typeof patch.description==='string')patch.description=sanitizeHtml(patch.description,{allowedTags:['p','br','strong','em','ul','ol','li','h2','h3','h4','a'],allowedAttributes:{a:['href','title']}});
    const {data:existing,error:existingError}=await db.from('products').select('id,status').eq('id',req.params.id).single();
    if(existingError)throw existingError;

    const isPublishing=allowed.status==='active'&&existing.status!=='active';
    if(isPublishing){
      try{
        // Stripe must be commerce-ready before the storefront is made public.
        await syncProductToStripe(req.params.id);
      }catch(stripeError){
        await db.from('products').update({status:'ready',stripe_sync_status:'error',stripe_sync_error:String(stripeError.message||stripeError).slice(0,2000)}).eq('id',req.params.id);
        return res.status(502).json({error:`Stripe sync failed. Product remains Ready. ${stripeError.message}`});
      }
      patch.published_at=new Date().toISOString();
    }

    const isUnpublishing=existing.status==='active'&&allowed.status&&allowed.status!=='active';
    if(isUnpublishing)await setStripeProductActive(req.params.id,false).catch(console.error);

    const {data,error}=await db.from('products').update(patch).eq('id',req.params.id).select().single();
    if(error)throw error;

    // Keep Stripe descriptive fields aligned when an already-published product is edited.
    const stripeRelevant=['title','slug','short_description','description','internal_sku'];
    if(data.status==='active'&&!isPublishing&&stripeRelevant.some(k=>Object.hasOwn(allowed,k))){
      await syncProductToStripe(req.params.id).catch(async stripeError=>{
        await db.from('products').update({stripe_sync_status:'error',stripe_sync_error:String(stripeError.message||stripeError).slice(0,2000)}).eq('id',req.params.id);
      });
    }
    res.json({product:data});
  }catch(e){next(e);}
});

router.put('/admin/products/:id/merchandising', requireAdmin, async(req,res,next)=>{
  try{
    const body=z.object({
      categoryIds:z.array(z.string().uuid()).default([]),collectionIds:z.array(z.string().uuid()).default([]),tagIds:z.array(z.string().uuid()).default([]),
      attributes:z.array(z.object({id:z.string().uuid().optional(),attribute_id:z.string().uuid().nullable().optional(),name:z.string().min(1).max(120),values:z.array(z.string().max(120)).max(50),visible:z.boolean(),used_for_variations:z.boolean(),sort_order:z.number().int()})).default([])
    }).parse(req.body);
    const db=supabaseAdmin();const pid=req.params.id;
    await Promise.all([db.from('product_categories').delete().eq('product_id',pid),db.from('product_collections').delete().eq('product_id',pid),db.from('product_tags').delete().eq('product_id',pid),db.from('product_attributes').delete().eq('product_id',pid)]);
    if(body.categoryIds.length){const {error}=await db.from('product_categories').insert(body.categoryIds.map((id,i)=>({product_id:pid,category_id:id,is_primary:i===0})));if(error)throw error;}
    if(body.collectionIds.length){const {error}=await db.from('product_collections').insert(body.collectionIds.map(id=>({product_id:pid,collection_id:id})));if(error)throw error;}
    if(body.tagIds.length){const {error}=await db.from('product_tags').insert(body.tagIds.map(id=>({product_id:pid,tag_id:id})));if(error)throw error;}
    if(body.attributes.length){const {error}=await db.from('product_attributes').insert(body.attributes.map(a=>({product_id:pid,attribute_id:a.attribute_id||null,name:a.name,values:a.values,visible:a.visible,used_for_variations:a.used_for_variations,sort_order:a.sort_order})));if(error)throw error;}

    // Keep the lightweight storefront fields in sync with the richer taxonomy model.
    const [cats,cols,tgs]=await Promise.all([
      body.categoryIds.length?db.from('categories').select('id,slug').in('id',body.categoryIds):Promise.resolve({data:[]}),
      body.collectionIds.length?db.from('collections').select('id,slug').in('id',body.collectionIds):Promise.resolve({data:[]}),
      body.tagIds.length?db.from('tags').select('id,name').in('id',body.tagIds):Promise.resolve({data:[]})
    ]);
    const catMap=new Map((cats.data||[]).map(x=>[x.id,x.slug]));const colMap=new Map((cols.data||[]).map(x=>[x.id,x.slug]));const tagMap=new Map((tgs.data||[]).map(x=>[x.id,x.name]));
    const legacyPatch={tags:body.tagIds.map(id=>tagMap.get(id)).filter(Boolean)};
    const primarySlug=body.categoryIds.length?catMap.get(body.categoryIds[0]):null;
    if(['rings','necklaces','earrings','bracelets'].includes(primarySlug))legacyPatch.category=primarySlug;
    legacyPatch.collection=body.collectionIds.length?(colMap.get(body.collectionIds[0])||null):null;
    await db.from('products').update(legacyPatch).eq('id',pid);
    res.json({ok:true});
  }catch(e){next(e);}
});

router.post('/admin/products/:id/variants', requireAdmin, async(req,res,next)=>{
  try{
    const body=z.object({sku:z.string().min(1).max(100),title:z.string().min(1).max(120),price_minor:z.number().int().min(0),compare_at_minor:z.number().int().min(0).nullable().optional(),attributes:z.record(z.string(),z.any()).default({}),active:z.boolean().default(true)}).parse(req.body);
    const db=supabaseAdmin();const {data,error}=await db.from('product_variants').insert({...body,product_id:req.params.id,zq_sku:`MANUAL-${body.sku}`,currency:'GBP'}).select().single();if(error)throw error;
    res.status(201).json({variant:data});
  }catch(e){next(e);}
});

router.patch('/admin/variants/:id', requireAdmin, async(req,res,next)=>{
  try{
    const body=z.object({
      title:z.string().max(120).optional(),sku:z.string().max(100).optional(),price_minor:z.number().int().min(0).optional(),compare_at_minor:z.number().int().min(0).nullable().optional(),
      barcode:z.string().max(100).nullable().optional(),attributes:z.record(z.string(),z.any()).optional(),active:z.boolean().optional(),manage_stock:z.boolean().optional(),allow_backorder:z.boolean().optional(),low_stock_threshold:z.number().int().nullable().optional(),image_url:z.string().max(1000).nullable().optional()
    }).parse(req.body);
    const db=supabaseAdmin();const {data,error}=await db.from('product_variants').update(body).eq('id',req.params.id).select().single();
    if(error)throw error;
    if(Object.hasOwn(body,'price_minor')||Object.hasOwn(body,'active')||Object.hasOwn(body,'title')||Object.hasOwn(body,'sku')){
      const {data:parent}=await db.from('products').select('status').eq('id',data.product_id).maybeSingle();
      if(parent?.status==='active')await syncProductToStripe(data.product_id);
    }
    res.json({variant:data});
  }catch(e){next(e);}
});
router.delete('/admin/variants/:id', requireAdmin, async(req,res,next)=>{
  try{const db=supabaseAdmin();const {error}=await db.from('product_variants').delete().eq('id',req.params.id);if(error)throw error;res.json({ok:true});}catch(e){next(e);}
});

router.post('/admin/products/:id/images', requireAdmin, async(req,res,next)=>{
  try{
    const body=z.object({url:z.string().url(),alt_text:z.string().max(300).default(''),is_primary:z.boolean().default(false)}).parse(req.body);const db=supabaseAdmin();
    if(body.is_primary)await db.from('product_images').update({is_primary:false}).eq('product_id',req.params.id);
    const {count}=await db.from('product_images').select('*',{count:'exact',head:true}).eq('product_id',req.params.id);
    const {data,error}=await db.from('product_images').insert({...body,product_id:req.params.id,sort_order:count||0}).select().single();if(error)throw error;res.status(201).json({image:data});
  }catch(e){next(e);}
});
router.patch('/admin/images/:id', requireAdmin, async(req,res,next)=>{
  try{const body=z.object({alt_text:z.string().max(300).optional(),sort_order:z.number().int().optional(),is_primary:z.boolean().optional()}).parse(req.body);const db=supabaseAdmin();
    if(body.is_primary){const {data:im}=await db.from('product_images').select('product_id').eq('id',req.params.id).single();if(im)await db.from('product_images').update({is_primary:false}).eq('product_id',im.product_id);}
    const {data,error}=await db.from('product_images').update(body).eq('id',req.params.id).select().single();if(error)throw error;res.json({image:data});}catch(e){next(e);}
});
router.delete('/admin/images/:id', requireAdmin, async(req,res,next)=>{
  try{const db=supabaseAdmin();const {error}=await db.from('product_images').delete().eq('id',req.params.id);if(error)throw error;res.json({ok:true});}catch(e){next(e);}
});

router.post('/admin/products/:id/sync-zq', requireAdmin, async(req,res,next)=>{
  try{
    const body=z.object({fields:z.array(z.enum(['inventory','cost','weight','supplier_status','images'])).min(1)}).parse(req.body);
    const db=supabaseAdmin();const {data:product,error}=await db.from('products').select('*,product_variants(*),product_images(*)').eq('id',req.params.id).single();if(error)throw error;
    const zqProductId=product.zq_product_id||product.product_variants?.find(v=>v.zq_product_id)?.zq_product_id;
    if(!zqProductId)return res.status(400).json({error:'This product is not linked to a ZQ product.'});
    const source=await zq.getImportProduct(zqProductId);const now=new Date().toISOString();
    const productPatch={zq_product_id:Number(zqProductId),zq_raw:source,zq_last_synced_at:now};
    if(body.fields.includes('supplier_status'))productPatch.zq_source_status=source.status||null;
    const specs=source.specs||[];
    for(const v of product.product_variants||[]){
      if(!v.zq_sku)continue;const spec=specs.find(s=>String(s.skuId)===String(v.zq_sku)||String(s.id)===String(v.zq_spec_id));const patch={zq_last_synced_at:now};
      if(spec&&body.fields.includes('cost')){patch.cost_minor=Math.round(Number(spec.cost||0)*100);patch.cost_currency=source.targetCurrency||v.cost_currency||null;}
      if(spec&&body.fields.includes('weight'))patch.weight_kg=Number(spec.weight||0);
      if(body.fields.includes('inventory')){
        try{const rows=await zq.getInventory(v.zq_sku);const list=Array.isArray(rows)?rows:[];const totals=list.reduce((a,r)=>({available:a.available+Number(r.availableCount||0),locked:a.locked+Number(r.lockQuantity||0),transit:a.transit+Number(r.onTransitQuantity||0)}),{available:0,locked:0,transit:0});Object.assign(patch,{inventory_quantity:totals.available,inventory_locked:totals.locked,inventory_in_transit:totals.transit});}catch{}
      }
      await db.from('product_variants').update(patch).eq('id',v.id);
    }
    if(body.fields.includes('images')){
      const existing=new Set((product.product_images||[]).map(i=>i.url));const add=(source.images||[]).filter(i=>i.image&&!existing.has(i.image)).map((im,i)=>({product_id:product.id,url:im.image,alt_text:`${product.title} – supplier view ${(product.product_images||[]).length+i+1}`,sort_order:(product.product_images||[]).length+i,is_primary:false}));if(add.length)await db.from('product_images').insert(add);
    }
    await db.from('products').update(productPatch).eq('id',product.id);
    await db.from('zq_sync_log').insert({product_id:product.id,zq_product_id:Number(zqProductId),sync_type:'manual',fields:body.fields,success:true,detail:{sourceStatus:source.status||null}});
    res.json({ok:true,syncedAt:now});
  }catch(e){next(e);}
});

router.get('/cron/zq-sync', async(req,res,next)=>{
  try{
    if(!process.env.CRON_SECRET||req.headers.authorization!==`Bearer ${process.env.CRON_SECRET}`)return res.status(401).json({error:'Unauthorized'});
    const [orders,inventory]=await Promise.all([syncOpenZqOrders(),syncZqInventory(zq)]);res.json({orders,inventory});
  }catch(e){next(e);}
});

export default router;
