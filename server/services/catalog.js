import { supabaseAdmin } from '../lib/supabase.js';

const PRODUCT_SELECT = `
  id, slug, title, subtitle, description, short_description, category, collection,
  status, visibility, featured, ivy_edit, new_arrival, seo_title, seo_description, canonical_url, og_title, og_description, og_image_url, meta_robots, tags,
  material_summary, care, origin_note, country_of_origin, lead_time, dimensions, reviews_enabled, published_at, created_at, updated_at,
  product_variants(
    id, sku, zq_sku, zq_product_id, zq_spec_id, title, attributes,
    price_minor, compare_at_minor, cost_minor, currency, weight_kg,
    inventory_quantity, inventory_locked, inventory_in_transit, active, sort_order
  ),
  product_images(id, variant_id, url, alt_text, width, height, sort_order, is_primary)
`;

function normalize(product) {
  if (!product) return null;
  const variants = [...(product.product_variants || [])]
    .filter(v => v.active)
    .sort((a,b) => a.sort_order - b.sort_order);
  const images = [...(product.product_images || [])]
    .sort((a,b) => Number(b.is_primary)-Number(a.is_primary) || a.sort_order-b.sort_order);
  const prices = variants.map(v => v.price_minor).filter(Number.isFinite);
  return {
    ...product,
    variants,
    images,
    price_minor: prices.length ? Math.min(...prices) : 0,
    max_price_minor: prices.length ? Math.max(...prices) : 0,
    product_variants: undefined,
    product_images: undefined
  };
}

export async function listProducts({ category, collection, ivyEdit, newArrival, featured, search, limit=24, offset=0 }={}) {
  const db = supabaseAdmin();
  let q = db.from('products').select(PRODUCT_SELECT).eq('status','active').neq('visibility','hidden')
    .order('published_at', { ascending:false, nullsFirst:false })
    .range(offset, offset + Math.min(limit,60) - 1);
  if (category) q=q.eq('category',category);
  if (collection) q=q.eq('collection',collection);
  if (ivyEdit) q=q.eq('ivy_edit',true);
  if (newArrival) q=q.eq('new_arrival',true);
  if (featured) q=q.eq('featured',true);
  if (search) q=q.or(`title.ilike.%${search.replace(/[%_,]/g,'')}%,short_description.ilike.%${search.replace(/[%_,]/g,'')}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data||[]).map(normalize);
}

export async function getProductBySlug(slug) {
  const db = supabaseAdmin();
  const { data, error } = await db.from('products').select(PRODUCT_SELECT)
    .eq('slug',slug).eq('status','active').neq('visibility','hidden').maybeSingle();
  if (error) throw error;
  return normalize(data);
}

export async function getProductsByVariantIds(ids) {
  if (!ids?.length) return [];
  const db=supabaseAdmin();
  const { data, error }=await db.from('product_variants').select(`
    id, product_id, sku, zq_sku, zq_product_id, zq_spec_id, title, attributes,
    price_minor, compare_at_minor, cost_minor, currency, weight_kg,
    inventory_quantity, inventory_locked, inventory_in_transit, active,
    products!inner(id,slug,title,status,category),
    product_images(id,url,alt_text,is_primary,sort_order)
  `).in('id',ids).eq('active',true).eq('products.status','active');
  if(error) throw error;
  return data||[];
}

export async function listJournal() {
  const db=supabaseAdmin();
  const {data,error}=await db.from('journal_posts').select('*').eq('status','published').order('published_at',{ascending:false});
  if(error) throw error;
  return data||[];
}

export async function getJournalPost(slug) {
  const db=supabaseAdmin();
  const {data,error}=await db.from('journal_posts').select('*').eq('slug',slug).eq('status','published').maybeSingle();
  if(error) throw error;
  return data;
}

export async function sitemapRecords() {
  const db=supabaseAdmin();
  const [{data:products},{data:posts}]=await Promise.all([
    db.from('products').select('slug,updated_at').eq('status','active'),
    db.from('journal_posts').select('slug,updated_at').eq('status','published')
  ]);
  return {products:products||[],posts:posts||[]};
}


export async function syncZqInventory(zqClient) {
  const db=supabaseAdmin();
  const {data:variants,error}=await db.from('product_variants')
    .select('id,zq_sku,inventory_quantity,inventory_locked,inventory_in_transit,products!inner(sync_inventory)')
    .eq('active',true).eq('products.sync_inventory',true).limit(300);
  if(error) throw error;
  const results=[];
  for(const v of variants||[]){
    try{
      const rows=await zqClient.getInventory(v.zq_sku);
      const list=Array.isArray(rows)?rows:[];
      const totals=list.reduce((a,r)=>({
        available:a.available+Number(r.availableCount||0),
        locked:a.locked+Number(r.lockQuantity||0),
        transit:a.transit+Number(r.onTransitQuantity||0)
      }),{available:0,locked:0,transit:0});
      await db.from('product_variants').update({
        inventory_quantity:totals.available,
        inventory_locked:totals.locked,
        inventory_in_transit:totals.transit
      }).eq('id',v.id);
      results.push({sku:v.zq_sku,ok:true,...totals});
    }catch(e){results.push({sku:v.zq_sku,ok:false,error:e.message});}
  }
  return results;
}
