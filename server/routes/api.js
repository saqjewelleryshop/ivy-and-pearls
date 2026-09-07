import { Router } from 'express';
import { z } from 'zod';
import { sensitiveLimiter } from '../middleware/security.js';
import { supabaseAdmin, getUserFromRequest, requireUser, requireAdmin } from '../lib/supabase.js';
import { listProducts, getProductBySlug, listJournal, getJournalPost, syncZqInventory } from '../services/catalog.js';
import { createPayment, loadOrderFull, submitOrderToZq, syncOpenZqOrders } from '../services/orders.js';
import { zq } from '../lib/zq.js';
import { sendEmail } from '../services/email.js';
import sanitizeHtml from 'sanitize-html';
import multer from 'multer';
import crypto from 'crypto';

const router=Router();

const upload=multer({
  storage:multer.memoryStorage(),
  limits:{
    fileSize:8*1024*1024
  },
  fileFilter:(req,file,cb)=>{
    const allowed=[
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if(!allowed.includes(file.mimetype)){
      return cb(
        new Error(
          'Only JPG, PNG and WebP images are allowed.'
        )
      );
    }

    cb(null,true);
  }
});

/**
 * Slugify a filename: lowercase, replace special chars with hyphens,
 * strip leading/trailing hyphens, append a short hex suffix.
 * Example: "Rose Gold Bangle.JPG" → "rose-gold-bangle-a41f928c.jpg"
 */
function slugifyFileName(originalName,buffer){
  // Create a short unique suffix from buffer content (first 4 bytes as hex)
  const buf=buffer&&buffer.length>=4?buffer.slice(0,4):crypto.randomBytes(4);
  const suffix=Buffer.from(buf).toString('hex').slice(0,8);

  // Slugify the basename
  const base=originalName.replace(/\.[^.]+$/,''); // strip extension
  const slug=base
    .toLowerCase()
    .trim()
    .replace(/&/g,'and')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'');

  const ext=originalName.split('.').pop()?.toLowerCase()||'jpg';
  return `${slug}-${suffix}.${ext}`;
}

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

function cleanZqAttributes(attributes=[]){
  const result={};

  for(const a of attributes||[]){
    const key=String(
      a.attributeName||
      a.name||
      a.attributeId||
      ''
    ).trim();

    const value=String(
      a.valueName||
      a.value||
      ''
    ).trim();

    if(key&&value){
      result[key]=value;
    }
  }

  return result;
}


function getZqVariantTitle(spec,index){
  const attrs=cleanZqAttributes(
    spec.attributes||[]
  );

  /*
   * Prefer a clean size label.
   */
  const sizeEntry=Object.entries(attrs).find(
    ([key])=>
      key.toLowerCase().includes('size') ||
      key.toLowerCase().includes('尺寸') ||
      key.toLowerCase().includes('尺码')
  );

  if(sizeEntry?.[1]){
    return `Size ${sizeEntry[1]}`;
  }

  /*
   * Then use the supplier spec text.
   */
  const supplierSpec=String(
    spec.spec||
    spec.specName||
    ''
  ).trim();

  if(supplierSpec){
    /*
     * Don't prepend Size if supplier already gives
     * a meaningful option description.
     */
    if(
      /^[a-z0-9]{1,4}$/i.test(supplierSpec)
    ){
      return `Size ${supplierSpec}`;
    }

    return supplierSpec;
  }

  /*
   * Then fall back to joined attribute values.
   */
  const values=Object.values(attrs)
    .filter(Boolean);

  if(values.length){
    return values.join(' · ');
  }

  return `Option ${index+1}`;
}


function normaliseZqInventoryResponse(response){
  if(Array.isArray(response)){
    return response;
  }

  if(Array.isArray(response?.records)){
    return response.records;
  }

  if(Array.isArray(response?.list)){
    return response.list;
  }

  if(Array.isArray(response?.data)){
    return response.data;
  }

  if(response?.data){
    return [response.data];
  }

  if(response){
    return [response];
  }

  return [];
}


function totalZqInventory(response){
  const rows=normaliseZqInventoryResponse(
    response
  );

  return rows.reduce(
    (total,row)=>({
      available:
        total.available+
        Number(row.availableCount??0),

      locked:
        total.locked+
        Number(row.lockQuantity??0),

      transit:
        total.transit+
        Number(row.onTransitQuantity??0)
    }),
    {
      available:0,
      locked:0,
      transit:0
    }
  );
}

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
    const [{count:products},{count:orders},{count:contacts},{data:recent}]
    =await Promise.all([
      db
        .from('products')
        .select('*',{count:'exact',head:true})
        .neq('status','archived'),

      db
        .from('orders')
        .select('*',{count:'exact',head:true}),

      db
        .from('contact_messages')
        .select('*',{count:'exact',head:true})
        .eq('status','new'),

      db
        .from('orders')
        .select('order_number,status,total_minor,created_at')
        .order('created_at',{ascending:false})
        .limit(8)
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
      title:z.string().min(2).max(180),

      slug:z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),

      category:z.enum([
        'rings',
        'necklaces',
        'earrings',
        'bracelets'
      ]),

      collection:z.string().max(120).optional(),

      retailPricePounds:z
        .number()
        .min(1)
        .max(100000),

      shortDescription:z
        .string()
        .max(500)
        .default(''),

      description:z
        .string()
        .max(20000)
        .default(''),

      materialSummary:z
        .string()
        .max(1000)
        .default(''),

      active:z.boolean().default(false)

    }).parse(req.body);


    const db=supabaseAdmin();

    const zqProductId=Number(req.params.id);

    /*
     * Check if this ZQ product already exists in Ivy.
     *
     * This is especially important for products that were
     * previously "Remove from Ivy & Pearls" soft-deleted.
     */
    const {data:existing,error:existingError}=await db
      .from('products')
      .select(`
        id,
        title,
        slug,
        status,
        visibility,
        zq_product_id
      `)
      .eq('zq_product_id',zqProductId)
      .maybeSingle();

    if(existingError){
      throw existingError;
    }


    /*
     * ===============================================
     * RESTORE ARCHIVED PRODUCT
     * ===============================================
     */

    if(existing?.status==='archived'){

      const zqp=await zq.getImportProduct(zqProductId);

      const nextStatus=config.active
        ? 'active'
        : 'needs_review';

      const {data:restored,error:restoreError}=await db
        .from('products')
        .update({

          title:config.title,

          slug:config.slug,

          category:config.category,

          collection:config.collection||null,

          short_description:
            config.shortDescription,

          description:sanitizeHtml(
            config.description||
            zqp.description||
            '',
            {
              allowedTags:[
                'p',
                'br',
                'strong',
                'em',
                'ul',
                'ol',
                'li',
                'h2',
                'h3'
              ],
              allowedAttributes:{}
            }
          ),

          material_summary:
            config.materialSummary,

          status:nextStatus,

          visibility:'catalog_search',

          zq_source_status:
            zqp.status||null,

          zq_last_synced_at:
            new Date().toISOString(),

          zq_raw:zqp,

          updated_at:
            new Date().toISOString(),

          published_at:
            config.active
              ? new Date().toISOString()
              : null

        })
        .eq('id',existing.id)
        .select()
        .single();

      if(restoreError){
        throw restoreError;
      }

            /*
      * Refresh existing ZQ variant inventory when restoring
      * an archived Ivy & Pearls product.
      */
      const {data:existingVariants,error:variantsError}=await db
        .from('product_variants')
        .select('id,zq_sku,zq_spec_id')
        .eq('product_id',existing.id);

      if(variantsError){
        throw variantsError;
      }

      for(const variant of existingVariants||[]){
        if(!variant.zq_sku)continue;

        try{
          const inventoryResponse=await zq.getInventory(
            variant.zq_sku
          );

          console.log(
            'RESTORE ZQ INVENTORY',
            variant.zq_sku,
            inventoryResponse
          );

          const rows=
            Array.isArray(inventoryResponse)
              ? inventoryResponse
              : Array.isArray(inventoryResponse?.records)
                ? inventoryResponse.records
                : Array.isArray(inventoryResponse?.list)
                  ? inventoryResponse.list
                  : Array.isArray(inventoryResponse?.data)
                    ? inventoryResponse.data
                    : inventoryResponse?.data
                      ? [inventoryResponse.data]
                      : inventoryResponse
                        ? [inventoryResponse]
                        : [];

          const totals=rows.reduce(
            (total,row)=>({
              available:
                total.available+
                Number(row.availableCount??0),

              locked:
                total.locked+
                Number(row.lockQuantity??0),

              transit:
                total.transit+
                Number(row.onTransitQuantity??0)
            }),
            {
              available:0,
              locked:0,
              transit:0
            }
          );

          const {error:inventoryUpdateError}=await db
            .from('product_variants')
            .update({
              inventory_quantity:totals.available,
              inventory_locked:totals.locked,
              inventory_in_transit:totals.transit,
              zq_last_synced_at:new Date().toISOString()
            })
            .eq('id',variant.id);

          if(inventoryUpdateError){
            throw inventoryUpdateError;
          }

          console.log(
            `Restored ZQ stock ${variant.zq_sku}:`,
            totals
          );

        }catch(error){
          console.error(
            `Could not refresh restored ZQ SKU ${variant.zq_sku}:`,
            error
          );
        }
      }
      /*
       * Existing variants/images remain attached.
       *
       * We do NOT duplicate them.
       */

      return res.json({
        success:true,
        restored:true,
        productId:restored.id,
        slug:restored.slug,
        status:restored.status,
        message:
          'Archived Ivy & Pearls product restored from ZQ.'
      });
    }


    /*
     * ===============================================
     * ALREADY IMPORTED
     * ===============================================
     */

    if(existing){

      return res.status(409).json({
        error:
          'This ZQ product is already imported into Ivy & Pearls.',
        productId:existing.id,
        status:existing.status
      });

    }


    /*
     * ===============================================
     * NEW ZQ IMPORT
     * ===============================================
     */

    const zqp=await zq.getImportProduct(
      zqProductId
    );


    /*
     * Also protect against a duplicate slug belonging
     * to another Ivy product.
     */

    const {data:slugOwner,error:slugError}=await db
      .from('products')
      .select('id,title,status')
      .eq('slug',config.slug)
      .maybeSingle();

    if(slugError){
      throw slugError;
    }

    if(slugOwner){

      return res.status(409).json({
        error:
          `The slug "${config.slug}" is already being used by another Ivy & Pearls product.`
      });

    }


    const {data:product,error}=await db
      .from('products')
      .insert({

        slug:config.slug,

        title:config.title,

        short_description:
          config.shortDescription,

        description:sanitizeHtml(
          config.description||
          zqp.description||
          '',
          {
            allowedTags:[
              'p',
              'br',
              'strong',
              'em',
              'ul',
              'ol',
              'li',
              'h2',
              'h3'
            ],
            allowedAttributes:{}
          }
        ),

        category:config.category,

        collection:
          config.collection||null,

        material_summary:
          config.materialSummary,

        status:
          config.active
            ? 'active'
            : 'needs_review',

        visibility:'catalog_search',

        zq_product_id:zqProductId,

        zq_source_status:
          zqp.status||null,

        zq_last_synced_at:
          new Date().toISOString(),

        zq_raw:zqp,

        seo_title:
          `${config.title} | Ivy & Pearls`,

        seo_description:
          config.shortDescription||
          `Discover ${config.title} from Ivy & Pearls.`,

        published_at:
          config.active
            ? new Date().toISOString()
            : null

      })
      .select()
      .single();

    if(error){
      throw error;
    }


    /*
     * ===============================================
     * VARIANTS
     * ===============================================
     */

          /*
      * ===============================================
      * ZQ SUPPLIER VARIANTS
      * ===============================================
      */

      const allSpecs=Array.isArray(zqp.specs)
        ? zqp.specs
        : [];


      /*
      * Only accept genuine ZQ variants with a ZQ SKU.
      *
      * Some ZQ payloads may omit status, so don't require
      * PUBLISHED when a genuine skuId exists.
      */
      const specs=allSpecs.filter(spec=>{
        return (
          spec?.skuId!==undefined &&
          spec?.skuId!==null &&
          String(spec.skuId).trim()!==''
        );
      });


      if(!specs.length){
        /*
        * Do NOT allow an imported ZQ product to fall
        * through with zero real variants.
        *
        * Otherwise someone may create manual variants
        * and lose the supplier inventory mapping.
        */

        await db
          .from('products')
          .delete()
          .eq('id',product.id);

        throw new Error(
          `ZQ product ${zqProductId} returned no usable supplier variants/SKUs. Import cancelled.`
        );
      }


      /*
      * Protect against duplicate supplier SKUs in the
      * ZQ payload.
      */
      const uniqueSpecs=Array.from(
        new Map(
          specs.map(spec=>[
            String(spec.skuId),
            spec
          ])
        ).values()
      );


      const variants=await Promise.all(
        uniqueSpecs.map(async(spec,index)=>{

          const zqSku=String(spec.skuId);

          const customerAttributes=
            cleanZqAttributes(
              spec.attributes||[]
            );

          const customerTitle=
            getZqVariantTitle(
              spec,
              index
            );


          /*
          * -------------------------------
          * LIVE ZQ STOCK
          * -------------------------------
          */

          let inventory={
            available:0,
            locked:0,
            transit:0
          };

          try{
            const inventoryResponse=
              await zq.getInventory(zqSku);

            inventory=
              totalZqInventory(
                inventoryResponse
              );

            console.log(
              `Imported ZQ SKU ${zqSku}`,
              {
                title:customerTitle,
                inventory
              }
            );

          }catch(error){

            console.error(
              `Could not read initial ZQ inventory for ${zqSku}:`,
              error
            );

            /*
            * Product payload stock is only a fallback.
            */
            inventory.available=
              Number(
                spec.amountOnSale??0
              );
          }


          /*
          * -------------------------------
          * IVY VARIANT
          * -------------------------------
          */

          return {
            product_id:product.id,

            /*
            * This is YOUR customer/admin SKU.
            *
            * It is separate from the ZQ supplier SKU.
            */
            sku:
              `IP-${product.id
                .replaceAll('-','')
                .slice(0,8)
                .toUpperCase()}-${index+1}`,

            /*
            * REAL supplier mapping
            */
            zq_sku:zqSku,

            zq_product_id:zqProductId,

            zq_spec_id:
              spec.id!=null
                ? String(spec.id)
                : null,


            /*
            * Customer-facing variant name
            *
            * e.g. Size K
            */
            title:customerTitle,


            /*
            * Customer-facing attributes
            */
            attributes:
              customerAttributes,


            /*
            * Preserve raw supplier information separately.
            */
            supplier_title:
              String(
                spec.spec||
                spec.specName||
                customerTitle
              ),

            supplier_attributes:
              customerAttributes,


            /*
            * Ivy controls retail pricing.
            */
            price_minor:
              Math.round(
                config.retailPricePounds*100
              ),


            /*
            * ZQ supplier cost.
            */
            cost_minor:
              Math.round(
                Number(spec.cost??0)*100
              ),

            cost_currency:
              zqp.targetCurrency||null,

            currency:'GBP',


            /*
            * Supplier weight.
            */
            weight_kg:
              Number(spec.weight??0),


            /*
            * Real ZQ stock.
            */
            inventory_quantity:
              inventory.available,

            inventory_locked:
              inventory.locked,

            inventory_in_transit:
              inventory.transit,


            /*
            * ZQ-linked products should have stock managed
            * from ZQ rather than manually.
            */
            manage_stock:true,

            active:true,

            sort_order:index,

            zq_last_synced_at:
              new Date().toISOString()
          };
        })
      );


      /*
      * Insert all real ZQ variants.
      */
      const {error:variantError}=await db
        .from('product_variants')
        .insert(variants);

      if(variantError){

        /*
        * Don't leave behind a half-imported product.
        */
        await db
          .from('products')
          .delete()
          .eq('id',product.id);

        throw variantError;
      }


    /*
     * ===============================================
     * IMAGES
     * ===============================================
     */

    const images=(zqp.images||[])
      .filter(im=>im.image)
      .map((im,i)=>({

        product_id:product.id,

        url:im.image,

        alt_text:
          `${config.title}${
            i
              ? ` – view ${i+1}`
              : ''
          }`,

        sort_order:i,

        is_primary:
          Boolean(im.isMain)||i===0

      }));


    if(images.length){

      const {error:imageError}=await db
        .from('product_images')
        .insert(images);

      if(imageError){
        throw imageError;
      }

    }


    return res.status(201).json({

      success:true,

      restored:false,

      productId:product.id,

      slug:product.slug,

      status:product.status

    });


  }catch(error){

    console.error(
      'ZQ IMPORT ERROR:',
      error
    );

    return res.status(500).json({
      error:
        process.env.NODE_ENV==='production'
          ? 'ZQ product import failed.'
          : error?.message || String(error)
    });
  }
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

router.get('/admin/products/:id/detail', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();

    const {data,error}=await db
      .from('products')
      .select(`
        *,
        product_variants(*),
        product_images(*),
        product_attributes(*),
        product_categories(*,categories(*)),
        product_collections(*,collections(*)),
        product_tags(*,tags(*)),
        product_links!product_links_product_id_fkey(*),
        zq_sync_log(*)
      `)
      .eq('id',req.params.id)
      .single();

    if(error)throw error;

    res.json({product:data});

  }catch(e){
    next(e);
  }
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
    if(allowed.status==='active')patch.published_at=new Date().toISOString();
    const {data,error}=await db.from('products').update(patch).eq('id',req.params.id).select().single();
    if(error)throw error;res.json({product:data});
  }catch(e){next(e);}
});

router.delete('/admin/products/:id', requireAdmin, async(req,res,next)=>{
  try{
    const db=supabaseAdmin();
    const {id}=req.params;

    const {data:existing,error:findError}=await db
      .from('products')
      .select('id,title,status,visibility,zq_product_id')
      .eq('id',id)
      .maybeSingle();

    if(findError)throw findError;

    if(!existing){
      return res.status(404).json({
        error:'Product not found'
      });
    }

    const {data:product,error:updateError}=await db
      .from('products')
      .update({
        status:'archived',
        visibility:'hidden',
        updated_at:new Date().toISOString()
      })
      .eq('id',id)
      .select('id,title,status,visibility,zq_product_id')
      .single();

    if(updateError)throw updateError;

    /*
     * This intentionally does NOT call ZQ.
     * Only the Ivy & Pearls Supabase record is archived.
     */

    return res.json({
      success:true,
      message:'Product removed from Ivy & Pearls',
      product,
      zqUntouched:true
    });

  }catch(error){
    console.error(
      'Remove Ivy product error:',
      error
    );

    next(error);
  }
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
    if(error)throw error;res.json({variant:data});
  }catch(e){next(e);}
});

router.delete(
  '/admin/variants/:id',
  requireAdmin,
  async(req,res,next)=>{
    try{

      const db=supabaseAdmin();

      const {data:variant,error}=await db
        .from('product_variants')
        .update({
          active:false
        })
        .eq(
          'id',
          req.params.id
        )
        .select(`
          id,
          product_id,
          title,
          sku,
          zq_sku,
          active
        `)
        .maybeSingle();


      if(error){
        throw error;
      }


      if(!variant){
        return res.status(404).json({
          error:'Variant not found.'
        });
      }


      return res.json({
        success:true,

        message:
          'Variant removed from Ivy & Pearls.',

        variant,

        zqUntouched:true
      });


    }catch(error){

      console.error(
        'Remove Ivy variant error:',
        error
      );

      next(error);

    }
  }
);

router.post(
  '/admin/products/:id/variants/restore',
  requireAdmin,
  async(req,res,next)=>{
    try{

      const db=supabaseAdmin();

      const productId=req.params.id;

      const variantIds=
        Array.isArray(req.body?.variantIds)
          ? [...new Set(
              req.body.variantIds.map(String)
            )]
          : [];


      if(!variantIds.length){
        return res.status(400).json({
          error:'Select at least one variant.'
        });
      }


      const {data:variants,error:findError}=await db
        .from('product_variants')
        .select(`
          id,
          product_id,
          title,
          sku,
          zq_sku,
          active
        `)
        .eq('product_id',productId)
        .in('id',variantIds);


      if(findError){
        throw findError;
      }


      if(!variants?.length){
        return res.status(404).json({
          error:'No matching variants were found.'
        });
      }


      const foundIds=
        variants.map(v=>v.id);


      const {data:restored,error:updateError}=await db
        .from('product_variants')
        .update({
          active:true
        })
        .eq('product_id',productId)
        .in('id',foundIds)
        .select(`
          id,
          product_id,
          title,
          sku,
          zq_sku,
          active
        `);


      if(updateError){
        throw updateError;
      }


      return res.json({
        success:true,

        message:
          `${restored?.length||0} variant${
            restored?.length===1?'':'s'
          } restored.`,

        restored:restored||[],

        zqUntouched:true
      });


    }catch(error){

      console.error(
        'Restore variants error:',
        error
      );

      next(error);

    }
  }
);

router.post(
  '/admin/products/:id/variants/bulk-delete',
  requireAdmin,
  async(req,res,next)=>{
    try{
      const db=supabaseAdmin();

      const productId=req.params.id;

      const variantIds=Array.isArray(req.body?.variantIds)
        ? [...new Set(req.body.variantIds.map(String))]
        : [];


      if(!variantIds.length){
        return res.status(400).json({
          error:'Select at least one variant.'
        });
      }


      /*
       * Only variants belonging to this Ivy & Pearls product
       * may be affected.
       */
      const {data:variants,error:findError}=await db
        .from('product_variants')
        .select(`
          id,
          product_id,
          title,
          sku,
          zq_sku,
          active
        `)
        .eq('product_id',productId)
        .in('id',variantIds);


      if(findError){
        throw findError;
      }


      if(!variants?.length){
        return res.status(404).json({
          error:'No matching variants were found.'
        });
      }


      const foundIds=variants.map(v=>v.id);


      /*
       * Soft delete.
       *
       * We intentionally DO NOT call ZQ here.
       * Supplier variants remain completely untouched.
       */
      const {data:removed,error:updateError}=await db
        .from('product_variants')
        .update({
          active:false
        })
        .eq('product_id',productId)
        .in('id',foundIds)
        .select(`
          id,
          product_id,
          title,
          sku,
          zq_sku,
          active
        `);


      if(updateError){
        throw updateError;
      }


      return res.json({
        success:true,

        message:
          `${removed?.length||0} variant${
            removed?.length===1?'':'s'
          } removed from Ivy & Pearls.`,

        removed:removed||[],

        zqUntouched:true
      });


    }catch(error){

      console.error(
        'Bulk remove product variants error:',
        error
      );

      next(error);
    }
  }
);

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
router.delete(
  '/admin/images/:id',
  requireAdmin,
  async(req,res,next)=>{
    try{

      const db=supabaseAdmin();

      const imageId=req.params.id;


      /*
       * First load the image so we know whether it belongs
       * to Supabase Storage or is just an external/ZQ URL.
       */
      const {data:image,error:findError}=await db
        .from('product_images')
        .select(`
          id,
          product_id,
          url,
          storage_path,
          is_primary
        `)
        .eq('id',imageId)
        .maybeSingle();


      if(findError){
        throw findError;
      }


      if(!image){
        return res.status(404).json({
          error:'Image not found.'
        });
      }


      /*
       * If this was uploaded by Ivy & Pearls,
       * remove the actual object from Supabase Storage.
       *
       * ZQ/external images normally have storage_path=null
       * and are not touched remotely.
       */
      if(image.storage_path){

        const {error:storageError}=await db.storage
          .from('product-media')
          .remove([
            image.storage_path
          ]);


        if(storageError){
          throw new Error(
            `Could not remove image from storage: ${storageError.message}`
          );
        }
      }


      /*
       * Now remove the database record.
       */
      const {error:deleteError}=await db
        .from('product_images')
        .delete()
        .eq('id',imageId);


      if(deleteError){
        throw deleteError;
      }


      /*
       * If the deleted image was the primary image,
       * automatically promote the next image.
       */
      if(image.is_primary){

        const {data:nextImage,error:nextError}=await db
          .from('product_images')
          .select('id')
          .eq(
            'product_id',
            image.product_id
          )
          .order(
            'sort_order',
            {
              ascending:true
            }
          )
          .limit(1)
          .maybeSingle();


        if(nextError){
          throw nextError;
        }


        if(nextImage){

          const {error:primaryError}=await db
            .from('product_images')
            .update({
              is_primary:true
            })
            .eq(
              'id',
              nextImage.id
            );


          if(primaryError){
            throw primaryError;
          }
        }
      }


      return res.json({
        success:true,

        message:
          image.storage_path
            ? 'Image removed from product and Supabase Storage.'
            : 'Image removed from product.',

        storageDeleted:
          Boolean(image.storage_path)
      });


    }catch(error){

      console.error(
        'Remove product image error:',
        error
      );

      next(error);

    }
  }
);

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
        try{
          const inventoryResponse=
            await zq.getInventory(v.zq_sku);

          const rows=
            Array.isArray(inventoryResponse)
              ? inventoryResponse
              : Array.isArray(inventoryResponse?.records)
                ? inventoryResponse.records
                : Array.isArray(inventoryResponse?.list)
                  ? inventoryResponse.list
                : Array.isArray(inventoryResponse?.data)
                  ? inventoryResponse.data
                  : inventoryResponse?.data
                    ? [inventoryResponse.data]
                    : inventoryResponse
                      ? [inventoryResponse]
                      : [];

          const totals=rows.reduce(
            (total,row)=>({
              available:
                total.available+
                Number(row.availableCount??0),

              locked:
                total.locked+
                Number(row.lockQuantity??0),

              transit:
                total.transit+
                Number(row.onTransitQuantity??0)
            }),
            {
              available:0,
              locked:0,
              transit:0
            }
          );

          Object.assign(patch,{
            inventory_quantity:totals.available,
            inventory_locked:totals.locked,
            inventory_in_transit:totals.transit
          });

          console.log(
            `ZQ stock ${v.zq_sku}:`,
            totals
          );

        }catch(error){
          console.error(
            `ZQ inventory sync failed for ${v.zq_sku}:`,
            error
          );
        }
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

router.post(
  '/admin/migrate',
  requireAdmin,
  async(req,res,next)=>{
    try{
      const db=supabaseAdmin();
      const {error}=await db.rpc('run_sql',{sql:'ALTER TABLE product_images ALTER COLUMN product_id DROP NOT NULL;'});
      if(error) throw error;
      res.json({success:true,message:'Migration applied'});
    }catch(e){
      console.error('[MIGRATE] Error:', e.message);
      res.status(500).json({
        error:'Migration failed. The run_sql RPC does not exist on this project.',
        hint:'Run this SQL manually in Supabase Dashboard > SQL Editor:',
        sql:`ALTER TABLE product_images ALTER COLUMN product_id DROP NOT NULL;
COMMENT ON TABLE product_images IS 'Stores both product images (with product_id) and standalone media library items (with null product_id)';`
      });
    }
  }
);

router.post(
  '/admin/media/upload',
  requireAdmin,
  upload.single('image'),
  async(req,res,next)=>{
    try{
      const db=supabaseAdmin();

      if(!req.file){
        return res.status(400).json({
          error:'Choose an image to upload.'
        });
      }

      // Generate a slugified filename like "rose-gold-bangle-a41f928c.jpg"
      const filename=slugifyFileName(req.file.originalname,req.file.buffer);
      const storagePath=`media-library/${filename}`;

      const {error:uploadError}=
        await db.storage
          .from('product-media')
          .upload(
            storagePath,
            req.file.buffer,
            {
              contentType:req.file.mimetype,
              upsert:false,
              cacheControl:'31536000'
            }
          );

      if(uploadError){
        console.error('UPLOAD ERROR:', uploadError.message, uploadError);
        throw uploadError;
      }

      // This works on localhost and live without changing the database.
      const shortUrl=`/media/${filename}`;
      // Insert into media_library table
      const {data:item,error:itemError}=await db
        .from('media_library')
        .insert({
          filename,
          url:shortUrl,
          storage_path:storagePath,
          mime_type:req.file.mimetype,
          size_bytes:req.file.buffer.length,
          alt_text:req.body.alt_text||''
        })
        .select()
        .single();

      if(itemError){
        console.error('INSERT ERROR:', itemError.message, itemError);
        throw itemError;
      }

      return res.status(201).json({
        success:true,
        item,
        storagePath,
        shortUrl,
        publicUrl:item.url
      });

    }catch(error){
      console.error('Media upload failed:', error);
      next(error);
    }
  }
);

router.get(
  '/admin/media',
  requireAdmin,
  async(req,res,next)=>{
    try{
      const db=supabaseAdmin();
      const {data,error}=await db
        .from('media_library')
        .select('id,filename,url,storage_path,mime_type,size_bytes,alt_text,created_at')
        .order('created_at',{ascending:false});

      if(error) throw error;
      return res.json({images:data||[]});
    }catch(error){
      console.error('Admin media library error:', error);
      next(error);
    }
  }
);

export default router;

