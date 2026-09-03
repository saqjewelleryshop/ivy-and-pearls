import React,{useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import Seo from '../components/Seo';
import {useAuth} from '../context/AuthContext';
import {api, removeAdminProduct, bulkDeleteAdminVariants, restoreAdminVariants
} from '../lib/api';
import {money,date,slugify} from '../lib/format';

const NAV=['overview','products','media','catalogue','partner import','orders','payments'];
const PRODUCT_TABS=['general','pricing','inventory','variants','attributes','media','organisation','seo','shipping','payments','partner','advanced'];

export default function Admin(){
  const {session,user,loading}=useAuth();

  const [mounted,setMounted]=useState(false);
  const [tab,setTab]=useState('overview');
  const [data,setData]=useState(null);
  const [error,setError]=useState('');

  const headers=session
    ? {Authorization:`Bearer ${session.access_token}`}
    : {};

  useEffect(()=>{
    setMounted(true);
  },[]);

  useEffect(()=>{
    if(mounted&&session){
      loadOverview();
    }
  },[mounted,session?.access_token]);

  async function loadOverview(){
    try{
      setData(
        await api('/admin/dashboard',{headers})
      );

      setError('');
    }catch(e){
      setError(e.message);
    }
  }

  /*
   * IMPORTANT FOR SSR:
   *
   * Server and first browser render must output the
   * same HTML. We don't evaluate auth-dependent admin
   * markup until React has mounted in the browser.
   */
  if(!mounted||loading){
    return (
      <div className="loading-page">
        Loading admin…
      </div>
    );
  }

  if(!user){
    return (
      <section className="section container">
        <h1>Sign in required</h1>
        <p>Administrator access is required.</p>
      </section>
    );
  }

  if(error){
    return (
      <section className="section container">
        <h1>Admin</h1>
        <p>{error}</p>
      </section>
    );
  }
 return <><Seo title="Admin" description="Ivy & Pearls administration." path="/admin/" noindex/><section className="admin-shell"><aside className="admin-nav"><div><p className="eyebrow">Ivy &amp; Pearls</p><h1>Admin</h1></div>{NAV.map(x=><button key={x} className={tab===x?'is-active':''} onClick={()=>setTab(x)}>{x}</button>)}</aside><main className="admin-main">
 {tab==='overview'&&<Overview data={data}/>} {tab==='products'&&<Products headers={headers}/>} {tab==='media'&&<MediaLibrary headers={headers}/>} {tab==='catalogue'&&<Catalogue headers={headers}/>} {tab==='partner import'&&<ZqImport headers={headers}/>} {tab==='orders'&&<Orders headers={headers}/>} {tab==='payments'&&<Payments headers={headers}/>} </main></section></>
}

function Overview({data}){return <><div className="admin-title"><p className="eyebrow">Overview</p><h2>Store at a glance.</h2></div><div className="admin-stats"><div><span>Products</span><b>{data?.products??0}</b></div><div><span>Orders</span><b>{data?.orders??0}</b></div><div><span>New messages</span><b>{data?.newMessages??0}</b></div></div><section className="admin-panel"><h3>Recent orders</h3>{data?.recentOrders?.map(o=><div className="admin-row" key={o.order_number}><span>{o.order_number}</span><span>{o.status.replaceAll('_',' ')}</span><span>{money(o.total_minor)}</span><span>{date(o.created_at)}</span></div>)}</section></>}

function Products({headers}){
 const [products,setProducts]=useState([]),[selected,setSelected]=useState(null),[state,setState]=useState(''),[q,setQ]=useState('');
 const load=()=>api('/admin/products',{headers}).then(r=>setProducts(r.products||[]));useEffect(()=>{load()},[]);
 const visible=products
  .filter(p=>p.status!=='archived')
  .filter(p=>
    (p.title+' '+p.slug+' '+p.status)
      .toLowerCase()
      .includes(q.toLowerCase())
  );
 return <><div className="admin-title admin-title--toolbar"><div><p className="eyebrow">Catalogue</p><h2>Products.</h2><p>Import from an international partner as a linked draft, then control exactly what customers see here.</p></div><input className="admin-filter" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products…"/></div>{state&&<p className="admin-notice">{state}</p>}<div className="admin-product-table"><div className="admin-product-table__head"><span>Product</span><span>Status</span><span>Price</span><span>Stock</span><span>Partner</span></div>{visible.map(p=>{const variants=p.product_variants||[],prices=variants.map(v=>v.price_minor),stock=variants.reduce((a,v)=>a+(v.inventory_quantity||0),0);return <button key={p.id} className="admin-product-line" onClick={()=>setSelected(p.id)}><span className="admin-product-line__title">{p.product_images?.[0]&&<img src={p.product_images.sort((a,b)=>a.sort_order-b.sort_order)[0].url} alt=""/>}<span><b>{p.title}</b><small>/{p.slug}/</small></span></span><span><StatusPill status={p.status}/></span><span>{prices.length?money(Math.min(...prices)):'—'}</span><span>{stock}</span><span>{p.zq_product_id||variants.find(v=>v.zq_product_id)?.zq_product_id?'International partner':'Manual'}</span></button>})}</div>{selected&&<ProductEditor id={selected} headers={headers} onClose={()=>{setSelected(null);load()}} setState={setState}/>}</>;
}

function StatusPill({status}){return <span className={`admin-status admin-status--${status}`}>{String(status).replaceAll('_',' ')}</span>}

function ProductEditor({id,headers,onClose,setState}){
  const [product,setProduct]=useState(null);
  const [meta,setMeta]=useState(null);
  const [tab,setTab]=useState('general');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  const [removingProduct,setRemovingProduct]=useState(false);
  const [removeError,setRemoveError]=useState('');

  const load=async()=>{
    const [p,m]=await Promise.all([
      api(`/admin/products/${id}/detail`,{headers}),
      api('/admin/catalogue-meta',{headers})
    ]);

    setProduct(p.product);
    setMeta(m);
  };

  useEffect(()=>{
    load();
  },[id]);

  const patch=async(body)=>{
    setBusy(true);

    try{
      const r=await api(`/admin/products/${id}`,{
        method:'PATCH',
        headers,
        body:JSON.stringify(body)
      });

      setProduct(x=>({...x,...r.product}));
      setMessage('Saved.');
    }catch(e){
      setMessage(e.message);
    }finally{
      setBusy(false);
    }
  };

  async function handleRemoveProduct(){
    if(!product?.id)return;

    const confirmed=window.confirm(
        `Remove "${product.title}" from Ivy & Pearls?\n\n` +
        `This will hide the product from your Ivy & Pearls catalogue and storefront.\n\n` +
        `The product will remain untouched with the international partner.`
    );

    if(!confirmed)return;

    try{
        setRemovingProduct(true);
        setRemoveError('');

        const result = await removeAdminProduct(
            product.id,
            headers
        );

        if(
            !result?.success ||
            result?.product?.status !== 'archived'
        ){
            throw new Error(
                'The server did not archive the product.'
            );
        }

        setState(
            'Product removed from Ivy & Pearls. The international partner was not changed.'
        );

        onClose();

    }catch(error){
        console.error(error);

        setRemoveError(
        error.message || 'Could not remove product'
        );
    }finally{
        setRemovingProduct(false);
    }
    }

  if(!product||!meta){
    return (
      <div className="admin-modal">
        <div className="admin-editor admin-editor--loading">
          Loading product…
        </div>
      </div>
    );
  }

  const categoryIds=(product.product_categories||[]).map(x=>x.category_id);
  const collectionIds=(product.product_collections||[]).map(x=>x.collection_id);
  const tagIds=(product.product_tags||[]).map(x=>x.tag_id);

  const saveMerch=async(next={})=>{
    setBusy(true);

    try{
      await api(`/admin/products/${id}/merchandising`,{
        method:'PUT',
        headers,
        body:JSON.stringify({
          categoryIds:next.categoryIds??categoryIds,
          collectionIds:next.collectionIds??collectionIds,
          tagIds:next.tagIds??tagIds,
          attributes:next.attributes??(product.product_attributes||[]).map((a,i)=>({
            attribute_id:a.attribute_id,
            name:a.name,
            values:Array.isArray(a.values)?a.values:[],
            visible:a.visible,
            used_for_variations:a.used_for_variations,
            sort_order:i
          }))
        })
      });

      await load();
      setMessage('Merchandising saved.');
    }catch(e){
      setMessage(e.message);
    }finally{
      setBusy(false);
    }
  };
 return <div className="admin-modal admin-modal--editor"><div className="admin-editor"><header className="admin-editor__head"><div><p className="eyebrow">Edit product</p><h2>{product.title}</h2><div className="admin-editor__meta"><StatusPill status={product.status}/><span>{product.zq_product_id?`Partner #${product.zq_product_id}`:'Manual product'}</span>{busy&&<span>Saving…</span>}{message&&<span>{message}</span>}</div></div><button className="admin-editor__close" onClick={onClose} aria-label="Close editor">×</button></header><div className="admin-editor__layout"><nav className="admin-editor__tabs">{PRODUCT_TABS.map(t=><button key={t} className={tab===t?'is-active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav><section className="admin-editor__content">
 {tab==='general'&&<GeneralTab product={product} patch={patch}/>} {tab==='pricing'&&<PricingTab product={product} headers={headers} load={load}/>} {tab==='inventory'&&<InventoryTab product={product} headers={headers} load={load}/>} {tab==='variants'&&<VariantsTab product={product} headers={headers} load={load}/>} {tab==='attributes'&&<AttributesTab product={product} meta={meta} save={saveMerch}/>} {tab==='media'&&<MediaTab product={product} headers={headers} load={load}/>} {tab==='organisation'&&<OrganisationTab product={product} meta={meta} patch={patch} save={saveMerch}/>} {tab==='seo'&&<SeoTab product={product} patch={patch}/>} {tab==='shipping'&&<ShippingTab product={product} patch={patch}/>} {tab==='payments'&&<ProductPaymentsTab product={product} headers={headers} load={load}/>} {tab==='partner'&&<ZqTab product={product} headers={headers} load={load}/>} {tab==='advanced'&&<AdvancedTab
    product={product}
    patch={patch}
    onRemove={handleRemoveProduct}
    removing={removingProduct}
    removeError={removeError}
  />
  } </section></div><footer className="admin-editor__foot"><button className="button" onClick={onClose}>Close</button><a className="button button--dark" href={`/admin/preview/product/${product.slug}/`} target="_blank" rel="noreferrer">Preview ↗</a></footer></div></div>;
}


function Field({label,children,hint,className=''}){return <label className={`admin-field ${className}`}><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
function SaveInput({label,value='',onSave,type='text',hint}){const [v,setV]=useState(value??'');useEffect(()=>setV(value??''),[value]);return <Field label={label} hint={hint}><input type={type} value={v} onChange={e=>setV(e.target.value)} onBlur={()=>String(v)!==String(value??'')&&onSave(type==='number'?Number(v):v)}/></Field>}
function SaveText({label,value='',onSave,rows=5,hint}){const [v,setV]=useState(value??'');useEffect(()=>setV(value??''),[value]);return <Field label={label} hint={hint}><textarea rows={rows} value={v} onChange={e=>setV(e.target.value)} onBlur={()=>v!==(value??'')&&onSave(v)}/></Field>}

function GeneralTab({product,patch}){return <div className="admin-tab"><h3>General</h3><div className="admin-form-grid"><SaveInput label="Product title" value={product.title} onSave={title=>patch({title})}/><SaveInput label="URL slug" value={product.slug} onSave={slug=>patch({slug:slugify(slug)})}/><SaveInput label="Subtitle" value={product.subtitle} onSave={subtitle=>patch({subtitle})}/><SaveInput label="Internal SKU" value={product.internal_sku} onSave={internal_sku=>patch({internal_sku})}/><Field label="Status"><select value={product.status} onChange={e=>patch({status:e.target.value})}><option value="draft">Draft</option><option value="needs_review">Needs review</option><option value="ready">Ready</option><option value="active">Published</option><option value="archived">Archived</option><option value="supplier_unavailable">Supplier unavailable</option></select></Field><Field label="Visibility"><select value={product.visibility||'catalog_search'} onChange={e=>patch({visibility:e.target.value})}><option value="catalog_search">Shop & search</option><option value="catalog">Shop only</option><option value="search">Search only</option><option value="hidden">Hidden</option></select></Field></div><SaveText label="Short description" value={product.short_description} rows={4} onSave={short_description=>patch({short_description})}/><SaveText label="Full description (safe HTML supported)" value={product.description} rows={12} onSave={description=>patch({description})}/><SaveText label="Materials / product clarity" value={product.material_summary} rows={5} onSave={material_summary=>patch({material_summary})} hint="Only publish material claims you have verified."/><SaveText label="Care" value={product.care} rows={5} onSave={care=>patch({care})}/></div>}

function PricingTab({product,headers,load}){

  const variants=(product.product_variants||[])
    .filter(v=>v.active!==false)
    .sort(
      (a,b)=>
        Number(a.sort_order||0)-
        Number(b.sort_order||0)
    );


  async function save(v,body){

    await api(
      `/admin/variants/${v.id}`,
      {
        method:'PATCH',
        headers,
        body:JSON.stringify(body)
      }
    );

    await load();

  }


  return (
    <div className="admin-tab">

      <h3>Pricing</h3>

      <p className="admin-help">
        Retail pricing is controlled by Ivy &amp; Pearls
        and is never overwritten by international partner sync.
      </p>


      {variants.map(v=>(

        <div
          className="admin-variant-card"
          key={v.id}
        >

          <div>

            <b>
              {v.title}
            </b>

            <small>
              {v.sku}
            </small>

          </div>


          <MoneyEditor
            label="Retail price"
            value={v.price_minor}
            onSave={price_minor=>
              save(
                v,
                {price_minor}
              )
            }
          />


          <MoneyEditor
            label="Compare-at price"
            value={v.compare_at_minor}
            nullable
            onSave={compare_at_minor=>
              save(
                v,
                {compare_at_minor}
              )
            }
          />


          <div>

            <span>
              Partner cost
            </span>

            <b>
              {v.cost_minor!=null
                ? money(v.cost_minor)
                : '—'
              }
            </b>

          </div>


          <div>

            <span>
              Gross margin
            </span>

            <b>
              {v.cost_minor!=null&&v.price_minor
                ? `${Math.round(
                    (
                      1-
                      v.cost_minor/
                      v.price_minor
                    )*100
                  )}%`
                : '—'
              }
            </b>

          </div>

        </div>

      ))}


      {!variants.length&&(
        <div className="admin-empty-state">
          <p>No active variants to price.</p>
        </div>
      )}

    </div>
  );

}
function MoneyEditor({label,value,onSave,nullable}){const [v,setV]=useState(value==null?'':(value/100).toFixed(2));useEffect(()=>setV(value==null?'':(value/100).toFixed(2)),[value]);return <Field label={`${label} (£)`}><input type="number" min="0" step="0.01" value={v} onChange={e=>setV(e.target.value)} onBlur={()=>onSave(v===''&&nullable?null:Math.round(Number(v||0)*100))}/></Field>}

function InventoryTab({product,headers,load}){async function save(v,body){await api(`/admin/variants/${v.id}`,{method:'PATCH',headers,body:JSON.stringify(body)});load()}return <div className="admin-tab"><h3>Inventory</h3><p className="admin-help">International-partner stock is external inventory data. Your storefront reads the synchronized quantity, while backorder and low-stock behaviour remain under your control.</p>{(product.product_variants||[]).filter(v=>v.active!==false).map(v=><div className="admin-variant-card admin-variant-card--inventory" key={v.id}><div><b>{v.title}</b><small>Partner SKU: {v.zq_sku||'—'}</small></div><Metric label="Available" value={v.inventory_quantity}/><Metric label="Locked" value={v.inventory_locked}/><Metric label="In transit" value={v.inventory_in_transit}/><Field label="Low stock"><input type="number" defaultValue={v.low_stock_threshold??''} onBlur={e=>save(v,{low_stock_threshold:e.target.value===''?null:Number(e.target.value)})}/></Field><label className="admin-check"><input type="checkbox" checked={v.allow_backorder||false} onChange={e=>save(v,{allow_backorder:e.target.checked})}/> Allow backorders</label></div>)}</div>}
function Metric({label,value}){return <div className="admin-metric"><span>{label}</span><b>{value??0}</b></div>}

function VariantsTab({product,headers,load}){

  const [adding,setAdding]=useState(false);

  const [view,setView]=useState('active');

  const [selectedVariantIds,setSelectedVariantIds]=
    useState([]);

  const [removingVariants,setRemovingVariants]=
    useState(false);

  const [restoringVariants,setRestoringVariants]=
    useState(false);

  const [removeError,setRemoveError]=useState('');
  const [message,setMessage]=useState('');


  const allVariants=
    [...(product.product_variants||[])]
      .sort(
        (a,b)=>
          Number(a.sort_order||0)-
          Number(b.sort_order||0)
      );


  const variants=
    allVariants.filter(
      variant=>
        view==='active'
          ? variant.active!==false
          : variant.active===false
    );


  const activeCount=
    allVariants.filter(
      v=>v.active!==false
    ).length;


  const removedCount=
    allVariants.filter(
      v=>v.active===false
    ).length;


  useEffect(()=>{

    setSelectedVariantIds([]);
    setRemoveError('');
    setMessage('');

  },[
    product.id,
    view
  ]);


  async function save(v,body){

    await api(
      `/admin/variants/${v.id}`,
      {
        method:'PATCH',
        headers,
        body:JSON.stringify(body)
      }
    );

    await load();

  }


  function toggleVariant(id){

    setSelectedVariantIds(
      current=>
        current.includes(id)
          ? current.filter(
              variantId=>
                variantId!==id
            )
          : [
              ...current,
              id
            ]
    );

  }


  function toggleAll(){

    const ids=
      variants.map(v=>v.id);


    const allSelected=
      ids.length>0 &&
      ids.every(
        id=>
          selectedVariantIds.includes(id)
      );


    setSelectedVariantIds(
      allSelected
        ? []
        : ids
    );

  }


  async function removeSelected(){

    if(!selectedVariantIds.length){
      return;
    }


    const count=
      selectedVariantIds.length;


    const confirmed=
      window.confirm(
        `Remove ${count} selected variant${
          count===1?'':'s'
        } from Ivy & Pearls?\n\n`+
        `The international partner will not be changed.`
      );


    if(!confirmed){
      return;
    }


    try{

      setRemovingVariants(true);
      setRemoveError('');
      setMessage('');


      const result=
        await bulkDeleteAdminVariants(
          product.id,
          selectedVariantIds,
          headers
        );


      setSelectedVariantIds([]);

      setMessage(
        result?.message||
        'Selected variants removed.'
      );


      await load();


    }catch(error){

      setRemoveError(
        error?.message||
        'Could not remove selected variants.'
      );


    }finally{

      setRemovingVariants(false);

    }

  }


  async function restoreSelected(){

    if(!selectedVariantIds.length){
      return;
    }


    const count=
      selectedVariantIds.length;


    const confirmed=
      window.confirm(
        `Restore ${count} selected variant${
          count===1?'':'s'
        } to Ivy & Pearls?`
      );


    if(!confirmed){
      return;
    }


    try{

      setRestoringVariants(true);
      setRemoveError('');
      setMessage('');


      const result=
        await restoreAdminVariants(
          product.id,
          selectedVariantIds,
          headers
        );


      setSelectedVariantIds([]);

      setMessage(
        result?.message||
        'Selected variants restored.'
      );


      await load();


    }catch(error){

      setRemoveError(
        error?.message||
        'Could not restore selected variants.'
      );


    }finally{

      setRestoringVariants(false);

    }

  }


  const allSelected=
    variants.length>0 &&
    variants.every(
      variant=>
        selectedVariantIds.includes(
          variant.id
        )
    );


  return (

    <div className="admin-tab">


      <div className="admin-tab__head">

        <div>

          <h3>
            Variants
          </h3>

          <p className="admin-help">
            Manage customer-facing variants while
            preserving international partner mappings.
          </p>

        </div>


        <button
          type="button"
          className="button button--dark"
          onClick={()=>
            setAdding(!adding)
          }
        >
          + Variant
        </button>

      </div>


      {/* ACTIVE / REMOVED SWITCH */}

      <div className="admin-variant-switch">

        <button
          type="button"

          className={
            view==='active'
              ? 'is-active'
              : ''
          }

          onClick={()=>
            setView('active')
          }
        >

          Active

          <span>
            {activeCount}
          </span>

        </button>


        <button
          type="button"

          className={
            view==='removed'
              ? 'is-active'
              : ''
          }

          onClick={()=>
            setView('removed')
          }
        >

          Removed

          <span>
            {removedCount}
          </span>

        </button>

      </div>


      {adding&&view==='active'&&(

        <VariantCreator
          product={product}
          headers={headers}
          onDone={()=>{
            setAdding(false);
            load();
          }}
        />

      )}


      {variants.length>0&&(

        <div className="admin-variants-toolbar">

          <label className="admin-variants-select-all">

            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
            />

            <span>
              {selectedVariantIds.length
                ? `${selectedVariantIds.length} selected`
                : 'Select all'
              }
            </span>

          </label>


          {view==='active'?(

            <button
              type="button"

              className="admin-bulk-delete"

              disabled={
                !selectedVariantIds.length||
                removingVariants
              }

              onClick={removeSelected}
            >

              {removingVariants
                ? 'Removing…'
                : selectedVariantIds.length
                  ? `Remove selected (${selectedVariantIds.length})`
                  : 'Remove selected'
              }

            </button>

          ):(

            <button
              type="button"

              className="admin-bulk-restore"

              disabled={
                !selectedVariantIds.length||
                restoringVariants
              }

              onClick={restoreSelected}
            >

              {restoringVariants
                ? 'Restoring…'
                : selectedVariantIds.length
                  ? `Restore selected (${selectedVariantIds.length})`
                  : 'Restore selected'
              }

            </button>

          )}

        </div>

      )}


      {message&&(
        <p className="admin-notice">
          {message}
        </p>
      )}


      {removeError&&(
        <p className="admin-variants-error">
          {removeError}
        </p>
      )}


      {variants.map(v=>{

        const selected=
          selectedVariantIds.includes(
            v.id
          );


        return (

          <details
            key={v.id}

            className={
              `admin-variant-detail ${
                selected
                  ? 'is-selected'
                  : ''
              }`
            }
          >

            <summary>


              <span
                className="admin-variant-select"
                onClick={e=>
                  e.stopPropagation()
                }
              >

                <input
                  type="checkbox"

                  checked={selected}

                  onChange={()=>
                    toggleVariant(
                      v.id
                    )
                  }
                />

              </span>


              <span>

                <b>
                  {v.title}
                </b>

                <small>
                  {v.sku}
                </small>

              </span>


              <span>
                {money(v.price_minor)}
              </span>


              <span>
                {v.inventory_quantity} stock
              </span>


              <span>
                {v.active
                  ? 'Active'
                  : 'Removed'
                }
              </span>


            </summary>


            <div className="admin-form-grid">

              <SaveInput
                label="Variant title"
                value={v.title}
                onSave={title=>
                  save(v,{title})
                }
              />


              <SaveInput
                label="Store SKU"
                value={v.sku}
                onSave={sku=>
                  save(v,{sku})
                }
              />


              <SaveInput
                label="Barcode"
                value={v.barcode}
                onSave={barcode=>
                  save(v,{barcode})
                }
              />


              <SaveInput
                label="Variant image URL"
                value={v.image_url}
                onSave={image_url=>
                  save(
                    v,
                    {image_url}
                  )
                }
              />


              <Field
                label="Customer attributes JSON"
              >

                <textarea
                  rows="5"

                  defaultValue={
                    JSON.stringify(
                      v.attributes||{},
                      null,
                      2
                    )
                  }

                  onBlur={e=>{

                    try{

                      save(
                        v,
                        {
                          attributes:
                            JSON.parse(
                              e.target.value
                            )
                        }
                      );

                    }catch{

                      alert(
                        'Invalid JSON'
                      );

                    }

                  }}
                />

              </Field>


              <Field label="Partner mapping">

                <div className="admin-readonly">

                  <span>
                    Partner SKU
                  </span>

                  <b>
                    {v.zq_sku||'—'}
                  </b>


                  <span>
                    Partner spec
                  </span>

                  <b>
                    {v.zq_spec_id||'—'}
                  </b>

                </div>

              </Field>


            </div>

          </details>

        );

      })}


      {!variants.length&&(

        <div className="admin-empty-state">

          <p>
            {view==='active'
              ? 'No active variants.'
              : 'No removed variants.'
            }
          </p>

        </div>

      )}


    </div>

  );

}

function VariantCreator({product,headers,onDone}){const [f,setF]=useState({title:'',sku:'',price:'0.00'});async function submit(e){e.preventDefault();await api(`/admin/products/${product.id}/variants`,{method:'POST',headers,body:JSON.stringify({title:f.title,sku:f.sku,price_minor:Math.round(Number(f.price)*100),attributes:{},active:true})});onDone()}return <form className="admin-inline-create" onSubmit={submit}><input required placeholder="Variant title" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/><input required placeholder="SKU" value={f.sku} onChange={e=>setF({...f,sku:e.target.value})}/><input required type="number" min="0" step=".01" placeholder="Retail £" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/><button className="button button--dark">Create</button></form>}

function AttributesTab({product,meta,save}){const initial=(product.product_attributes||[]).map(a=>({...a,values:Array.isArray(a.values)?a.values:[]}));const [rows,setRows]=useState(initial);useEffect(()=>setRows(initial),[product.id,product.product_attributes?.length]);function addGlobal(id){const a=meta.attributes.find(x=>x.id===id);if(!a)return;setRows(x=>[...x,{attribute_id:a.id,name:a.name,values:[],visible:true,used_for_variations:false,sort_order:x.length}])}return <div className="admin-tab"><h3>Attributes</h3><p className="admin-help">Use reusable attributes such as Ring Size, Metal, Stone, Colour and Finish. Supplier labels can remain hidden while customers see your polished terminology.</p><div className="admin-attribute-add"><select defaultValue="" onChange={e=>{addGlobal(e.target.value);e.target.value=''}}><option value="" disabled>Add global attribute…</option>{meta.attributes.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><button className="button" onClick={()=>setRows(x=>[...x,{attribute_id:null,name:'',values:[],visible:true,used_for_variations:false,sort_order:x.length}])}>+ Custom</button></div>{rows.map((a,i)=><div className="admin-attribute-row" key={i}><input value={a.name} onChange={e=>setRows(x=>x.map((r,n)=>n===i?{...r,name:e.target.value}:r))} placeholder="Attribute name"/><input value={a.values.join(', ')} onChange={e=>setRows(x=>x.map((r,n)=>n===i?{...r,values:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}:r))} placeholder="Values separated by commas"/><label><input type="checkbox" checked={a.visible} onChange={e=>setRows(x=>x.map((r,n)=>n===i?{...r,visible:e.target.checked}:r))}/> Visible</label><label><input type="checkbox" checked={a.used_for_variations} onChange={e=>setRows(x=>x.map((r,n)=>n===i?{...r,used_for_variations:e.target.checked}:r))}/> Variations</label><button onClick={()=>setRows(x=>x.filter((_,n)=>n!==i))}>×</button></div>)}<button className="button button--dark" onClick={()=>save({attributes:rows.map((a,i)=>({...a,sort_order:i}))})}>Save attributes</button></div>}

function MediaTab({
  product,
  headers,
  load
}){

  const [url,setUrl]=useState('');
  const [alt,setAlt]=useState('');


  async function addUrl(event){

    event.preventDefault();

    await api(
      `/admin/products/${product.id}/images`,
      {
        method:'POST',
        headers,
        body:JSON.stringify({
          url,
          alt_text:alt,
          is_primary:
            !(product.product_images||[]).length
        })
      }
    );

    setUrl('');
    setAlt('');

    await load();
  }


  async function patch(id,body){

    await api(
      `/admin/images/${id}`,
      {
        method:'PATCH',
        headers,
        body:JSON.stringify(body)
      }
    );

    await load();
  }


  async function remove(id){

    await api(
      `/admin/images/${id}`,
      {
        method:'DELETE',
        headers
      }
    );

    await load();
  }


  return (

    <div className="admin-tab">

      <h3>
        Media
      </h3>

      <p className="admin-help">
        Manage images associated with this product. Upload new files from the main Media tab in the admin navigation, then paste the copied media path here.
      </p>


      {/* EXISTING IMAGES */}

      <div className="admin-media-grid">

        {(product.product_images||[])
          .sort(
            (a,b)=>
              a.sort_order-
              b.sort_order
          )
          .map(im=>(

            <article key={im.id}>

              <img
                src={im.url}
                alt={im.alt_text||''}
              />


              <textarea
                rows="2"

                defaultValue={
                  im.alt_text
                }

                onBlur={e=>
                  patch(
                    im.id,
                    {
                      alt_text:
                        e.target.value
                    }
                  )
                }
              />


              <input
                readOnly
                value={im.url}
                onFocus={e=>
                  e.target.select()
                }
              />


              <span
                className={
                  `admin-media-source ${
                    im.storage_path
                      ? 'is-owned'
                      : ''
                  }`
                }
              >
                {im.storage_path
                  ? 'Ivy & Pearls media'
                  : 'External / international partner image'
                }
              </span>


              <div>

                <button
                  type="button"

                  onClick={()=>
                    patch(
                      im.id,
                      {
                        is_primary:true
                      }
                    )
                  }
                >
                  {im.is_primary
                    ? 'Primary ✓'
                    : 'Make primary'
                  }
                </button>


                <button
                  type="button"

                  onClick={()=>
                    navigator.clipboard.writeText(
                      im.url
                    )
                  }
                >
                  Copy URL
                </button>


                <button
                  type="button"

                  className="admin-danger"

                  onClick={()=>
                    remove(im.id)
                  }
                >
                  Remove
                </button>

              </div>

            </article>

          ))
        }

      </div>


      {/* ADD EXTERNAL URL */}

      <form
        className="admin-inline-create"
        onSubmit={addUrl}
      >

        <input
          type="text"
          required
          placeholder="/media/image-name.webp or https://…"

          value={url}

          onChange={e=>
            setUrl(
              e.target.value
            )
          }
        />


        <input
          placeholder="Alt text"

          value={alt}

          onChange={e=>
            setAlt(
              e.target.value
            )
          }
        />


        <button
          className="button button--dark"
        >
          Add image URL
        </button>

      </form>

    </div>

  );
}

function OrganisationTab({product,meta,patch,save}){const categoryIds=(product.product_categories||[]).map(x=>x.category_id),collectionIds=(product.product_collections||[]).map(x=>x.collection_id),tagIds=(product.product_tags||[]).map(x=>x.tag_id);const [cats,setCats]=useState(categoryIds),[cols,setCols]=useState(collectionIds),[tags,setTags]=useState(tagIds);const toggle=(arr,set,id)=>set(arr.includes(id)?arr.filter(x=>x!==id):[...arr,id]);return <div className="admin-tab"><h3>Organisation</h3><div className="admin-form-grid"><Field label="Legacy primary category"><select value={product.category} onChange={e=>patch({category:e.target.value})}><option value="rings">Rings</option><option value="necklaces">Necklaces</option><option value="earrings">Earrings</option><option value="bracelets">Bracelets</option></select></Field><SaveInput label="Legacy collection slug" value={product.collection} onSave={collection=>patch({collection:collection||null})}/></div><TaxonomyBox title="Categories" rows={meta.categories} selected={cats} toggle={id=>toggle(cats,setCats,id)}/><TaxonomyBox title="Collections" rows={meta.collections} selected={cols} toggle={id=>toggle(cols,setCols,id)}/><TaxonomyBox title="Tags" rows={meta.tags} selected={tags} toggle={id=>toggle(tags,setTags,id)}/><div className="admin-flags"><label><input type="checkbox" checked={product.featured} onChange={e=>patch({featured:e.target.checked})}/> Featured</label><label><input type="checkbox" checked={product.new_arrival} onChange={e=>patch({new_arrival:e.target.checked})}/> New arrival</label><label><input type="checkbox" checked={product.ivy_edit} onChange={e=>patch({ivy_edit:e.target.checked})}/> The Ivy Edit</label></div><button className="button button--dark" onClick={()=>save({categoryIds:cats,collectionIds:cols,tagIds:tags})}>Save organisation</button></div>}
function TaxonomyBox({title,rows,selected,toggle}){return <div className="admin-taxonomy-box"><h4>{title}</h4><div>{rows.map(r=><label key={r.id}><input type="checkbox" checked={selected.includes(r.id)} onChange={()=>toggle(r.id)}/>{r.name}</label>)}</div></div>}

function SeoTab({product,patch}){const [title,setTitle]=useState(product.seo_title||''),[desc,setDesc]=useState(product.seo_description||'');return <div className="admin-tab"><h3>SEO & social</h3><p className="admin-help">This controls the server-rendered title, description, canonical and social preview used by the React storefront.</p><SaveInput label="SEO title" value={product.seo_title} onSave={seo_title=>patch({seo_title})} hint="Aim for a concise, descriptive title rather than keyword stuffing."/><SaveText label="Meta description" value={product.seo_description} rows={3} onSave={seo_description=>patch({seo_description})}/><SaveInput label="Canonical URL" value={product.canonical_url} onSave={canonical_url=>patch({canonical_url:canonical_url||null})}/><SaveInput label="Open Graph title" value={product.og_title} onSave={og_title=>patch({og_title:og_title||null})}/><SaveText label="Open Graph description" value={product.og_description} rows={3} onSave={og_description=>patch({og_description:og_description||null})}/><SaveInput label="Open Graph image URL" value={product.og_image_url} onSave={og_image_url=>patch({og_image_url:og_image_url||null})}/><Field label="Robots"><select value={product.meta_robots||'index,follow'} onChange={e=>patch({meta_robots:e.target.value})}><option value="index,follow">Index, follow</option><option value="noindex,follow">Noindex, follow</option><option value="noindex,nofollow">Noindex, nofollow</option></select></Field><div className="seo-preview"><span>ivyandpearls.co.uk › product › {product.slug}</span><h4>{title||product.title}</h4><p>{desc||product.short_description||'Add a concise search description for this product.'}</p></div></div>}

function ShippingTab({product,patch}){const dims=product.dimensions||{};return <div className="admin-tab"><h3>Shipping</h3><div className="admin-form-grid"><SaveInput label="Country of origin" value={product.country_of_origin} onSave={country_of_origin=>patch({country_of_origin})}/><SaveInput label="Customer-facing lead time" value={product.lead_time} onSave={lead_time=>patch({lead_time})}/><SaveInput label="Tax class" value={product.tax_class||'standard'} onSave={tax_class=>patch({tax_class})}/><Field label="Dimensions (cm)"><div className="admin-dimensions">{['length','width','height'].map(k=><input key={k} type="number" step=".1" placeholder={k} defaultValue={dims[k]||''} onBlur={e=>patch({dimensions:{...dims,[k]:Number(e.target.value||0)}})}/>)}</div></Field></div><SaveText label="Origin / shipping note" value={product.origin_note} onSave={origin_note=>patch({origin_note})}/></div>}

function ProductPaymentsTab({product,headers,load}){
 const [state,setState]=useState('');
 async function sync(){setState('Syncing with Stripe…');try{await api(`/admin/products/${product.id}/sync-stripe`,{method:'POST',headers});setState('Stripe product and prices synced.');await load()}catch(e){setState(e.message)}}
 const variants=(product.product_variants||[])
  .filter(v=>v.active!==false);
 return <div className="admin-tab"><h3>Payments / Stripe</h3><p className="admin-help">Publishing automatically creates or updates the Stripe Product and one Stripe Price per active sellable variant. Retail prices remain controlled here in Ivy &amp; Pearls.</p><div className="admin-stripe-status"><div><span>Sync status</span><b>{product.stripe_sync_status||'not synced'}</b></div><div><span>Stripe Product</span><b>{product.stripe_product_id||'Not created'}</b></div><div><span>Last synced</span><b>{product.stripe_synced_at?date(product.stripe_synced_at):'Never'}</b></div></div>{product.stripe_sync_error&&<p className="form-error">{product.stripe_sync_error}</p>}<button className="button button--dark" onClick={sync}>Sync with Stripe</button>{state&&<p className="admin-notice">{state}</p>}<h4>Variant prices</h4><div className="admin-stripe-variants">{variants.map(v=><div key={v.id}><span><b>{v.title}</b><small>{v.sku}</small></span><span>{money(v.price_minor)}</span><span>{v.stripe_price_id||'Not synced'}</span></div>)}</div>{product.stripe_product_id&&<a className="button" href={`https://dashboard.stripe.com/${product.stripe_product_id}`} target="_blank" rel="noreferrer">Open in Stripe ↗</a>}</div>}

function ZqTab({product,headers,load}){const [fields,setFields]=useState(['inventory','cost','weight','supplier_status']),[state,setState]=useState('');const toggle=f=>setFields(x=>x.includes(f)?x.filter(y=>y!==f):[...x,f]);async function sync(){setState('Syncing…');try{await api(`/admin/products/${product.id}/sync-zq`,{method:'POST',headers,body:JSON.stringify({fields})});setState('Partner sync complete. Your merchandising fields were not overwritten.');load()}catch(e){setState(e.message)}}return <div className="admin-tab"><h3>International partner link</h3>{!product.zq_product_id?<p>This product has no international partner link.</p>:<><div className="admin-zq-card"><div><span>Partner product</span><b>#{product.zq_product_id}</b></div><div><span>Partner status</span><b>{product.zq_source_status||'—'}</b></div><div><span>Last synced</span><b>{product.zq_last_synced_at?date(product.zq_last_synced_at):'Never'}</b></div></div><h4>Automatic sync protection</h4><div className="admin-sync-switches">{[['sync_inventory','Inventory'],['sync_cost','Partner cost'],['sync_weight','Weight'],['sync_supplier_status','Partner status'],['sync_images','New partner images']].map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(product[key])} onChange={e=>api(`/admin/products/${product.id}`,{method:'PATCH',headers,body:JSON.stringify({[key]:e.target.checked})}).then(load)}/>{label}</label>)}</div><h4>Sync now</h4><div className="admin-sync-fields">{['inventory','cost','weight','supplier_status','images'].map(f=><label key={f}><input type="checkbox" checked={fields.includes(f)} onChange={()=>toggle(f)}/>{f.replace('_',' ')}</label>)}</div><button className="button button--dark" disabled={!fields.length} onClick={sync}>Sync selected fields</button><p>{state}</p><div className="admin-callout"><strong>Protected from partner overwrite</strong><p>Title, slug, descriptions, retail prices, categories, collections, tags, SEO, gallery order and customer-facing attributes remain controlled by Ivy &amp; Pearls.</p></div><h4>Recent sync history</h4>{(product.zq_sync_log||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,10).map(r=><div className="admin-sync-log" key={r.id}><span>{date(r.created_at)}</span><span>{r.sync_type}</span><span>{(r.fields||[]).join(', ')}</span><span>{r.success?'Success':'Failed'}</span></div>)}</>}</div>}

function AdvancedTab({
  product,
  patch,
  onRemove,
  removing,
  removeError
}){
  return (
    <div className="admin-tab">

      <h3>Advanced</h3>

      <div className="admin-form-grid">

        <SaveInput
          label="Menu order"
          type="number"
          value={product.menu_order||0}
          onSave={menu_order=>patch({menu_order})}
        />

        <Field label="Reviews">
          <select
            value={product.reviews_enabled?'yes':'no'}
            onChange={e=>
              patch({
                reviews_enabled:e.target.value==='yes'
              })
            }
          >
            <option value="yes">Enabled</option>
            <option value="no">Disabled</option>
          </select>
        </Field>

      </div>

      <SaveText
        label="Purchase note"
        value={product.purchase_note}
        rows={4}
        onSave={purchase_note=>patch({purchase_note})}
      />

      <Field
        label="Custom metadata (JSON)"
        hint="For structured internal metadata that does not belong in visible product copy."
      >
        <textarea
          rows="10"
          defaultValue={JSON.stringify(
            product.custom_meta||{},
            null,
            2
          )}
          onBlur={e=>{
            try{
              patch({
                custom_meta:JSON.parse(e.target.value)
              });
            }catch{
              alert('Invalid JSON');
            }
          }}
        />
      </Field>

      <div className="admin-readonly">
        <span>Product ID</span>
        <b>{product.id}</b>

        <span>Created</span>
        <b>{date(product.created_at)}</b>

        <span>Updated</span>
        <b>{date(product.updated_at)}</b>
      </div>


      {/* ===============================
          DANGER ZONE
      =============================== */}

      <div className="admin-danger-zone">

        <div>
          <p className="eyebrow">
            Danger zone
          </p>

          <h4>
            Remove from Ivy &amp; Pearls
          </h4>

          <p>
            Remove this product from your Ivy &amp; Pearls
            catalogue and storefront.
          </p>

          <p>
            The supplier product will remain completely
            untouched with the international partner and can be imported again later.
          </p>
        </div>

        {removeError&&(
          <p className="admin-danger-zone__error">
            {removeError}
          </p>
        )}

        <button
          type="button"
          className="admin-remove-product"
          onClick={onRemove}
          disabled={removing}
        >
          {removing
            ? 'Removing…'
            : 'Remove from Ivy & Pearls'
          }
        </button>

      </div>

    </div>
  );
}

function Catalogue({headers}){const [meta,setMeta]=useState(null),[type,setType]=useState('categories'),[name,setName]=useState(''),[state,setState]=useState('');const load=()=>api('/admin/catalogue-meta',{headers}).then(setMeta);useEffect(()=>{load()},[]);async function add(e){e.preventDefault();try{await api(`/admin/catalogue-meta/${type}`,{method:'POST',headers,body:JSON.stringify({name,slug:slugify(name),...(type==='attributes'?{type:'select'}:{})})});setName('');setState('Created.');load()}catch(e){setState(e.message)}}if(!meta)return <div className="loading-page">Loading catalogue…</div>;return <><div className="admin-title"><p className="eyebrow">Catalogue structure</p><h2>Taxonomies.</h2><p>Reusable categories, collections, tags and attributes keep product data consistent across the store.</p></div><div className="admin-taxonomy-tabs">{['categories','collections','tags','attributes'].map(t=><button className={type===t?'is-active':''} onClick={()=>setType(t)} key={t}>{t}</button>)}</div><div className="admin-panel"><form className="admin-inline-create" onSubmit={add}><input required placeholder={`New ${type.slice(0,-1)} name`} value={name} onChange={e=>setName(e.target.value)}/><button className="button button--dark">Add</button></form><p>{state}</p><div className="admin-taxonomy-list">{meta[type].map(r=><div key={r.id}><b>{r.name}</b><span>/{r.slug}/</span>{r.type&&<span>{r.type}</span>}</div>)}</div></div></>}

function ZqImport({headers}){
  const [q,setQ]=useState('');
  const [records,setRecords]=useState([]);
  const [selected,setSelected]=useState(null);

  const [form,setForm]=useState({
    title:'',
    slug:'',
    category:'earrings',
    collection:'',
    retailPricePounds:99,
    shortDescription:'',
    description:'',
    materialSummary:'',
    active:false
  });

  const [state,setState]=useState('');


  async function search(e){
    e?.preventDefault();

    setState('Searching international partners…');

    try{
      const r=await api(
        `/admin/zq/products?q=${encodeURIComponent(q)}`,
        {headers}
      );

      const rawRecords=r.records||r.list||[];

      const uniqueRecords=Array.from(
        new Map(
          rawRecords
            .filter(record=>record?.id)
            .map(record=>[
              String(record.id),
              record
            ])
        ).values()
      );

      setRecords(uniqueRecords);

      setState(
        uniqueRecords.length
          ? `${uniqueRecords.length} supplier products found.`
          : 'No supplier products found.'
      );

    }catch(error){
      console.error('Partner search failed:',error);

      setRecords([]);

      setState(
        error.message||
        'Could not search international partner products.'
      );
    }
  }
 async function choose(id){setState('Loading product…');try{const r=await api(`/admin/zq/products/${id}`,{headers});setSelected(r.product);setForm(f=>({...f,title:r.product.subject||'',slug:slugify(r.product.subject||''),description:r.product.description||''}));setState('')}catch(e){setState(e.message)}}
 async function submit(e){e.preventDefault();setState('Importing…');try{const r=await api(`/admin/zq/import/${selected.id}`,{method:'POST',headers,body:JSON.stringify({...form,retailPricePounds:Number(form.retailPricePounds)})});setState(`Imported ${r.slug} into Needs Review. Open Products to merchandise it before publishing.`);setSelected(null)}catch(e){setState(e.message)}}
 const f=n=>({value:form[n],onChange:e=>setForm(x=>({...x,[n]:e.target.type==='checkbox'?e.target.checked:e.target.value}))});
 return <><div className="admin-title"><p className="eyebrow">International partner import</p><h2>Partner products.</h2><p>International partners provide source catalogue and fulfilment data; Ivy & Pearls remains the storefront source of truth. Import products into review, then rewrite and organise them before publication.</p></div><form className="admin-search" onSubmit={search}><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Product name, ID or SKU"/><button className="button button--dark">Search partners</button></form><p>{state}</p><div className="zq-grid">
  {records.map(r=>
    <button
      className="zq-card"
      onClick={()=>choose(r.id)}
      key={`zq-${r.id}`}
    >
      {r.images?.[0]?.image&&(
        <img
          src={r.images[0].image}
          alt=""
        />
      )}

      <span>{r.subject}</span>

      <small>#{r.id}</small>

      <em>Import as draft</em>
    </button>
  )}
</div>{selected&&<div className="admin-modal"><form onSubmit={submit}><button type="button" className="admin-modal__close" onClick={()=>setSelected(null)}>×</button><p className="eyebrow">International partner → Ivy &amp; Pearls</p><h3>Prepare supplier product</h3><div className="form-grid"><label>Product title<input required {...f('title')}/></label><label>
  URL slug
  <input
    required
    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
    title="Use lowercase letters, numbers and single hyphens only."
    {...f('slug')}
  />
</label><label>Primary category<select {...f('category')}><option value="rings">Rings</option><option value="necklaces">Necklaces</option><option value="earrings">Earrings</option><option value="bracelets">Bracelets</option></select></label><label>Starting retail price (£)<input type="number" min="1" step=".01" {...f('retailPricePounds')}/></label><label className="span-2">Short description<textarea {...f('shortDescription')}/></label><label className="span-2">Verified material summary<textarea {...f('materialSummary')} placeholder="Only enter verified material information."/></label></div><label className="check-line"><input type="checkbox" checked={form.active} onChange={f('active').onChange}/><span>Publish immediately (recommended off until review is complete)</span></label><button className="button button--dark">Import supplier product</button></form></div>}</>}

function Payments({headers}){
 const [data,setData]=useState(null),[form,setForm]=useState(null),[state,setState]=useState(''),[liveConfirm,setLiveConfirm]=useState('');
 const load=()=>api('/admin/payments/stripe',{headers}).then(r=>{setData(r);setForm(r.settings)});useEffect(()=>{load()},[]);
 if(!form)return <div className="loading-page">Loading Stripe settings…</div>;
 const set=(k,v)=>setForm(x=>({...x,[k]:v}));
 async function save(e){e.preventDefault();setState('Saving…');try{const body={enabled:Boolean(form.enabled),mode:form.mode,test_publishable_key:form.test_publishable_key||null,live_publishable_key:form.live_publishable_key||null,currency:String(form.currency||'GBP').toUpperCase(),automatic_payment_methods:Boolean(form.automatic_payment_methods),receipt_emails:Boolean(form.receipt_emails),minimum_order_minor:Number(form.minimum_order_minor||0),statement_descriptor:form.statement_descriptor||null,...(form.mode==='live'?{confirmLive:liveConfirm}:{})};const r=await api('/admin/payments/stripe',{method:'PATCH',headers,body:JSON.stringify(body)});setForm(r.settings);setData(x=>({...x,settings:r.settings,secrets:r.secrets}));setState('Saved.')}catch(e){setState(e.message)}}
 async function test(){setState('Testing Stripe connection…');try{const r=await api('/admin/payments/stripe/test',{method:'POST',headers});setState(`Connected to ${r.accountId} · ${r.mode.toUpperCase()} · charges ${r.chargesEnabled?'enabled':'not enabled'}.`)}catch(e){setState(e.message)}}
 const secrets=data?.secrets||{};
 return <><div className="admin-title"><p className="eyebrow">Payments</p><h2>Stripe.</h2><p>Control storefront payment mode here. Secret API keys and webhook signing secrets stay in server environment variables and are never returned to the browser.</p></div><form className="admin-panel admin-payments" onSubmit={save}><div className="admin-form-grid"><Field label="Payments"><select value={form.enabled?'enabled':'disabled'} onChange={e=>set('enabled',e.target.value==='enabled')}><option value="disabled">Disabled</option><option value="enabled">Enabled</option></select></Field><Field label="Mode"><select value={form.mode} onChange={e=>set('mode',e.target.value)}><option value="test">Test</option><option value="live">Live</option></select></Field><Field label="Currency"><input value={form.currency||'GBP'} maxLength="3" onChange={e=>set('currency',e.target.value.toUpperCase())}/></Field><Field label="Minimum order (pence)"><input type="number" min="0" value={form.minimum_order_minor??50} onChange={e=>set('minimum_order_minor',Number(e.target.value))}/></Field><Field label="Test publishable key"><input value={form.test_publishable_key||''} placeholder="pk_test_…" onChange={e=>set('test_publishable_key',e.target.value)}/></Field><Field label="Live publishable key"><input value={form.live_publishable_key||''} placeholder="pk_live_…" onChange={e=>set('live_publishable_key',e.target.value)}/></Field><Field label="Statement descriptor" hint="Optional; Stripe rules apply."><input value={form.statement_descriptor||''} maxLength="22" onChange={e=>set('statement_descriptor',e.target.value)}/></Field></div><label className="admin-check"><input type="checkbox" checked={Boolean(form.automatic_payment_methods)} onChange={e=>set('automatic_payment_methods',e.target.checked)}/> Automatic payment methods</label><label className="admin-check"><input type="checkbox" checked={Boolean(form.receipt_emails)} onChange={e=>set('receipt_emails',e.target.checked)}/> Ask Stripe to send payment receipts</label>{form.mode==='live'&&<Field label="Confirm live mode" hint="Type LIVE before saving live mode."><input value={liveConfirm} onChange={e=>setLiveConfirm(e.target.value)} placeholder="LIVE"/></Field>}<div className="admin-secret-status"><div><span>Test secret key</span><b>{secrets.testSecretConfigured?'Configured ✓':'Missing'}</b></div><div><span>Test webhook secret</span><b>{secrets.testWebhookConfigured?'Configured ✓':'Missing'}</b></div><div><span>Live secret key</span><b>{secrets.liveSecretConfigured?'Configured ✓':'Missing'}</b></div><div><span>Live webhook secret</span><b>{secrets.liveWebhookConfigured?'Configured ✓':'Missing'}</b></div></div><div className="admin-payments-actions"><button className="button button--dark">Save Stripe settings</button><button className="button" type="button" onClick={test}>Test Stripe connection</button><a className="button" href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">Open Stripe Dashboard ↗</a></div>{state&&<p className="admin-notice">{state}</p>}</form><section className="admin-panel"><h3>Webhook health</h3>{(data?.lastEvents||[]).length?(data.lastEvents||[]).map(ev=><div className="admin-row" key={ev.id}><span>{ev.event_type}</span><span>{ev.livemode?'LIVE':'TEST'}</span><span>{ev.success?'Success':'Failed'}</span><span>{date(ev.created_at)}</span></div>):<p>No Stripe webhook events recorded yet.</p>}</section></>}

function Orders({headers}){const [orders,setOrders]=useState([]),[state,setState]=useState('');const load=()=>api('/admin/orders',{headers}).then(r=>setOrders(r.orders));useEffect(()=>{load()},[]);async function retry(id){setState('Submitting to international partner…');try{await api(`/admin/orders/${id}/retry-zq`,{method:'POST',headers});setState('Submitted.');load()}catch(e){setState(e.message)}}return <><div className="admin-title"><p className="eyebrow">Orders</p><h2>Fulfilment.</h2><p>{state}</p></div><div className="admin-orders">{orders.map(o=><details key={o.id}><summary><b>{o.order_number}</b><span>{o.status.replaceAll('_',' ')}</span><span>{money(o.total_minor)}</span><span>{date(o.created_at)}</span></summary><div className="admin-order-body"><p>{o.email}</p><p>Partner fulfilment: {o.zq_platform_order_id||'Not yet submitted'} · {o.zq_status||'—'}</p><p>Tracking: {o.tracking_number||'Awaiting tracking'}</p>{o.order_items?.map(i=><p key={i.id}>{i.product_name} · {i.variant_name} × {i.quantity}</p>)}{o.status==='fulfilment_error'&&<button className="button button--dark" onClick={()=>retry(o.id)}>Retry partner fulfilment</button>}</div></details>)}</div></>}

function MediaLibrary({headers}){
  const [images,setImages]=useState([]);
  const [loading,setLoading]=useState(true);
  const [copyMsg,setCopyMsg]=useState('');
  const [uploading,setUploading]=useState(false);
  const [message,setMessage]=useState('');

  const load=()=>api('/admin/media',{headers}).then(r=>{setImages(r.images||[]);setLoading(false)}).catch(e=>{console.error(e);setLoading(false)});

  useEffect(()=>{
    load();
  },[]);

  async function copyUrl(url){
    try{await navigator.clipboard.writeText(url);setCopyMsg('Copied!');setTimeout(()=>setCopyMsg(''),2000)}
    catch(e){console.error(e)}
  }

  async function uploadFile(event){
    const file=event.target.files?.[0];
    if(!file) return;
    try{
      setUploading(true);
      setMessage('');
      const form=new FormData();
      form.append('image',file);
      const response=await fetch('/api/admin/media/upload',{method:'POST',headers,body:form});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||`Upload failed (${response.status})`);
      setMessage('Image uploaded successfully.');
      await load();
    }catch(error){
      setMessage(error.message||'Could not upload image.');
    }finally{
      setUploading(false);
      event.target.value='';
    }
  }

  if(loading) return <div className="loading-page">Loading media library…</div>;

  // Use local /media/:filename route when on localhost for image display
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  function getImageUrl(im) {
    if (isLocal) {
      return `/media/${im.filename}`;
    }
    return im.url;
  }
  function getCopyUrl(im) {
    return im.url; // Always copy the production URL
  }

  return (
    <>
      <div className="admin-title">
        <p className="eyebrow">Media Library</p>
        <h2>Images.</h2>
        <p>A complete overview of all owned media stored in Supabase, sorted by most recent.</p>
      </div>
      {message && <p className="admin-notice">{message}</p>}
      <div className="admin-media-upload">
        <div>
          <p className="eyebrow">Upload</p>
          <h3>Add new media</h3>
          <p>Upload JPG, PNG or WebP files to Ivy &amp; Pearls Supabase Storage.</p>
        </div>
        <label className="button button--dark">
          {uploading ? 'Uploading…' : 'Upload image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={uploading}
            onChange={uploadFile}
          />
        </label>
      </div>
      {copyMsg && <p className="admin-notice">{copyMsg}</p>}
      {images.length > 0 ? (
        <div className="admin-media-library">
          {images.map(im => (
            <article key={im.id} className="admin-media-library__item">
              <img src={getImageUrl(im)} alt={im.alt_text||''} className="admin-media-library__img"/>
              <div className="admin-media-library__info">
                <strong>{im.filename}</strong>
                <small>{im.mime_type||'Unknown type'}</small>
                <input readOnly value={getCopyUrl(im)} onFocus={e=>e.target.select()}/>
                <button className="button button--dark" onClick={()=>copyUrl(getCopyUrl(im))}>
                  Copy media URL
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state">
          <p>No media found.</p>
        </div>
      )}
    </>
  );
}
