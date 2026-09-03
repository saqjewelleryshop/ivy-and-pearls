import { supabaseAdmin } from '../lib/supabase.js';

const PRODUCT_SELECT = `
  id,
  slug,
  title,
  subtitle,
  description,
  short_description,
  category,
  collection,
  status,
  visibility,
  featured,
  ivy_edit,
  new_arrival,
  seo_title,
  seo_description,
  canonical_url,
  og_title,
  og_description,
  og_image_url,
  meta_robots,
  tags,
  material_summary,
  care,
  origin_note,
  country_of_origin,
  lead_time,
  dimensions,
  reviews_enabled,
  published_at,
  created_at,
  updated_at,

  product_variants(
    id,
    sku,
    zq_sku,
    zq_product_id,
    zq_spec_id,
    title,
    attributes,
    image_url,
    price_minor,
    compare_at_minor,
    cost_minor,
    currency,
    weight_kg,
    inventory_quantity,
    inventory_locked,
    inventory_in_transit,
    active,
    sort_order
  ),
  
  product_images(
    id,
    variant_id,
    url,
    alt_text,
    width,
    height,
    sort_order,
    is_primary
  ),

  product_attributes(
    id,
    attribute_id,
    name,
    values,
    visible,
    used_for_variations,
    sort_order
  )
`;



const LEGACY_PRODUCT_SELECT = `
  id,
  slug,
  title,
  subtitle,
  description,
  short_description,
  category,
  collection,
  status,
  featured,
  ivy_edit,
  new_arrival,
  seo_title,
  seo_description,
  material_summary,
  care,
  origin_note,
  published_at,
  created_at,
  updated_at,
  product_variants(
    id,
    sku,
    zq_sku,
    zq_product_id,
    zq_spec_id,
    title,
    attributes,
    price_minor,
    compare_at_minor,
    cost_minor,
    currency,
    weight_kg,
    inventory_quantity,
    inventory_locked,
    inventory_in_transit,
    active,
    sort_order
  ),
  product_images(
    id,
    variant_id,
    url,
    alt_text,
    width,
    height,
    sort_order,
    is_primary
  )
`;

function isSchemaCompatibilityError(error){
  const code=String(error?.code||'');
  const message=String(error?.message||'').toLowerCase();
  return ['42703','42P01','PGRST200','PGRST204'].includes(code) ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find a relationship');
}

function storefrontTitle(title=''){
  const value=String(title||'').trim();
  const exact=new Map([
    ['Medium Stone-Set Bangle Bracelet – 18cm Gold, Rose Gold & White Gold Tone','Medium Stone-Set Bangle – 18cm'],
    ['925 Sterling Silver Double-Circle Pavé Nail Bracelet – Luxury Thick Diamond-Style Bangle','Double-Circle Pavé Bangle in Sterling Silver']
  ]);
  return exact.get(value)||value;
}

function normalize(product){
  if(!product)return null;


  const variants=[
    ...(product.product_variants||[])
  ]
    .filter(v=>v.active)
    .sort(
      (a,b)=>
        Number(a.sort_order||0)-
        Number(b.sort_order||0)
    );


  const images=[
    ...(product.product_images||[])
  ]
    .sort(
      (a,b)=>
        Number(b.is_primary)-
        Number(a.is_primary) ||
        Number(a.sort_order||0)-
        Number(b.sort_order||0)
    );


  /*
   * Rich product attributes created in Admin.
   *
   * Example:
   *
   * Metal   -> AU750 18K Gold
   * Stone   -> Moissanite
   * Setting -> Four-Claw Setting
   */
  const attributes=[
    ...(product.product_attributes||[])
  ]
    .filter(attribute=>
      attribute.visible!==false
    )
    .sort(
      (a,b)=>
        Number(a.sort_order||0)-
        Number(b.sort_order||0)
    );


  const prices=variants
    .map(v=>Number(v.price_minor))
    .filter(Number.isFinite);


  return {
    ...product,
    title:storefrontTitle(product.title),

    variants,

    images,

    attributes,

    price_minor:
      prices.length
        ? Math.min(...prices)
        : 0,

    max_price_minor:
      prices.length
        ? Math.max(...prices)
        : 0,

    /*
     * Remove raw Supabase relationship names from
     * the public storefront object.
     */
    product_variants:undefined,
    product_images:undefined,
    product_attributes:undefined
  };
}


export async function listProducts({
  category,
  collection,
  ivyEdit,
  newArrival,
  featured,
  search,
  limit=24,
  offset=0
}={}){
  const db=supabaseAdmin();

  async function run(select,enhanced){
    let q=db
      .from('products')
      .select(select)
      .eq('status','active')
      .order('published_at',{ascending:false,nullsFirst:false})
      .range(offset,offset+Math.min(limit,60)-1);

    if(enhanced)q=q.neq('visibility','hidden');
    if(category)q=q.eq('category',category);
    if(collection)q=q.eq('collection',collection);
    if(ivyEdit)q=q.eq('ivy_edit',true);
    if(newArrival)q=q.eq('new_arrival',true);
    if(featured)q=q.eq('featured',true);
    if(search){
      const safeSearch=String(search).replace(/[%_,]/g,'');
      q=q.or(`title.ilike.%${safeSearch}%,short_description.ilike.%${safeSearch}%`);
    }
    return await q;
  }

  let result=await run(PRODUCT_SELECT,true);
  if(result.error&&isSchemaCompatibilityError(result.error)){
    console.warn('[catalog] Latest merchandising schema unavailable; using legacy storefront read compatibility.');
    result=await run(LEGACY_PRODUCT_SELECT,false);
  }
  if(result.error)throw result.error;
  return (result.data||[]).map(normalize);
}

export async function getProductBySlug(slug){
  const db=supabaseAdmin();
  async function run(select,enhanced){
    let q=db.from('products').select(select).eq('slug',slug).eq('status','active');
    if(enhanced)q=q.neq('visibility','hidden');
    return await q.maybeSingle();
  }
  let result=await run(PRODUCT_SELECT,true);
  if(result.error&&isSchemaCompatibilityError(result.error)){
    console.warn('[catalog] Falling back to legacy product-detail schema.');
    result=await run(LEGACY_PRODUCT_SELECT,false);
  }
  if(result.error)throw result.error;
  return normalize(result.data);
}

export async function getProductsByIds(ids=[]){
  const clean=[...new Set((ids||[]).map(String).filter(Boolean))].slice(0,100);
  if(!clean.length)return [];
  const db=supabaseAdmin();
  async function run(select,enhanced){
    let q=db.from('products').select(select).in('id',clean).eq('status','active');
    if(enhanced)q=q.neq('visibility','hidden');
    return await q;
  }
  let result=await run(PRODUCT_SELECT,true);
  if(result.error&&isSchemaCompatibilityError(result.error))result=await run(LEGACY_PRODUCT_SELECT,false);
  if(result.error)throw result.error;
  const order=new Map(clean.map((id,index)=>[id,index]));
  return (result.data||[]).map(normalize).sort((a,b)=>(order.get(String(a.id))??999)-(order.get(String(b.id))??999));
}

export async function getProductsByVariantIds(ids){

  if(!ids?.length){
    return [];
  }


  const db=supabaseAdmin();


  const {data,error}=await db
    .from('product_variants')
    .select(`
      id,
      product_id,
      sku,
      zq_sku,
      zq_product_id,
      zq_spec_id,
      title,
      attributes,
      image_url,
      price_minor,
      compare_at_minor,
      cost_minor,
      currency,
      weight_kg,
      inventory_quantity,
      inventory_locked,
      inventory_in_transit,
      active,

      products!inner(
        id,
        slug,
        title,
        status,
        category
      ),

      product_images(
        id,
        url,
        alt_text,
        is_primary,
        sort_order
      )
    `)
    .in(
      'id',
      ids
    )
    .eq(
      'active',
      true
    )
    .eq(
      'products.status',
      'active'
    );


  if(error){
    throw error;
  }


  return data||[];
}


export async function listJournal(){

  const db=supabaseAdmin();

  const {data,error}=await db
    .from('journal_posts')
    .select('*')
    .eq(
      'status',
      'published'
    )
    .order(
      'published_at',
      {
        ascending:false
      }
    );


  if(error){
    throw error;
  }


  return data||[];
}


export async function getJournalPost(slug){

  const db=supabaseAdmin();

  const {data,error}=await db
    .from('journal_posts')
    .select('*')
    .eq(
      'slug',
      slug
    )
    .eq(
      'status',
      'published'
    )
    .maybeSingle();


  if(error){
    throw error;
  }


  return data;
}


export async function sitemapRecords(){

  const db=supabaseAdmin();


  const [
    {data:products},
    {data:posts}
  ]=await Promise.all([

    db
      .from('products')
      .select(
        'slug,updated_at'
      )
      .eq(
        'status',
        'active'
      ),

    db
      .from('journal_posts')
      .select(
        'slug,updated_at'
      )
      .eq(
        'status',
        'published'
      )

  ]);


  return {
    products:products||[],
    posts:posts||[]
  };
}


export async function syncZqInventory(zqClient){

  const db=supabaseAdmin();


  const {data:variants,error}=await db
    .from('product_variants')
    .select(`
      id,
      zq_sku,
      inventory_quantity,
      inventory_locked,
      inventory_in_transit,
      products!inner(sync_inventory)
    `)
    .eq(
      'active',
      true
    )
    .eq(
      'products.sync_inventory',
      true
    )
    .limit(300);


  if(error){
    throw error;
  }


  const results=[];


  for(const v of variants||[]){

    /*
     * Never ask ZQ for inventory belonging to
     * manually-created Ivy variants.
     */
    if(
      !v.zq_sku ||
      String(v.zq_sku)
        .startsWith('MANUAL-')
    ){
      results.push({
        sku:v.zq_sku,
        ok:false,
        skipped:true,
        error:'Variant is not linked to a real ZQ SKU.'
      });

      continue;
    }


    try{

      const inventoryResponse=
        await zqClient.getInventory(
          v.zq_sku
        );


      const list=
        Array.isArray(inventoryResponse)
          ? inventoryResponse

          : Array.isArray(
              inventoryResponse?.records
            )
            ? inventoryResponse.records

            : Array.isArray(
                inventoryResponse?.list
              )
              ? inventoryResponse.list

              : Array.isArray(
                  inventoryResponse?.data
                )
                ? inventoryResponse.data

                : inventoryResponse?.data
                  ? [inventoryResponse.data]

                  : inventoryResponse
                    ? [inventoryResponse]
                    : [];


      const totals=list.reduce(
        (total,row)=>({

          available:
            total.available+
            Number(
              row.availableCount??0
            ),

          locked:
            total.locked+
            Number(
              row.lockQuantity??0
            ),

          transit:
            total.transit+
            Number(
              row.onTransitQuantity??0
            )

        }),
        {
          available:0,
          locked:0,
          transit:0
        }
      );


      const {error:updateError}=await db
        .from('product_variants')
        .update({
          inventory_quantity:
            totals.available,

          inventory_locked:
            totals.locked,

          inventory_in_transit:
            totals.transit
        })
        .eq(
          'id',
          v.id
        );


      if(updateError){
        throw updateError;
      }


      results.push({
        sku:v.zq_sku,
        ok:true,
        ...totals
      });


    }catch(error){

      results.push({
        sku:v.zq_sku,
        ok:false,
        error:error.message
      });

    }
  }


  return results;
}