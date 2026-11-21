import { supabase, TABLES, publicImageUrl, currency, cleanPhone, toast } from '../lib/supabase.js';
import { gestureAxis, tiltFromDrag, rotationFromDrag, swipeDirection, isBackFacing } from '../lib/visor-touch.js';

const $ = (id) => document.getElementById(id);
const collator = new Intl.Collator('es-MX', { sensitivity: 'base' });
const state = { products: [], settings: {}, brand: 'all', search: '', sort: 'default', current: null };
const frameNames = [
  ['foto_frontal_path', 'Frente'], ['foto_lateral_derecha_path','Lado derecho'],
  ['foto_trasera_path','Tapa trasera'], ['foto_lateral_izquierda_path','Lado izquierdo']
];
const viewer = { frames: [], index: 0, pointerId: null, pointerType: 'mouse', axis: 'pending', startX: 0, startY: 0, lastX: 0, lastY: 0, baseAngle: 0, baseTiltX: 0, baseTiltY: 0, tiltX: 0, tiltY: 0, auto: null, rafId: null, rafLast: 0, angle: 0, mode: 'single' };
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function photoUrl(product) {return publicImageUrl(product.foto_portada_path || product.foto_frontal_path || product.foto_trasera_path || '');}
function image(img, src, fallback) { img.src = src || fallback; img.addEventListener('error', () => { if (img.src !== new URL(fallback, location.href).href) img.src = fallback; }, { once: true }); }
function framesFor(product) {
  // Los recortes demostrativos antiguos no son vistas independientes y daban un falso giro.
  // Solo usamos imágenes de ángulos separadas subidas por el administrador.
  const frames = frameNames.filter(([key]) => product[key] && !String(product[key]).startsWith('/demo/')).map(([key,label]) => ({ label, src:publicImageUrl(product[key]) }));
  if (frames.length) return frames;
  const cover = photoUrl(product);
  return cover ? [{label:'Fotografía del modelo', src:cover}] : [];
}
function renderFilters() {
  const list = $('brand-filters'); list.replaceChildren();
  const brands = [...new Set(state.products.map(p => p.marca).filter(Boolean))].sort(collator.compare);
  for (const brand of ['all', ...brands]) {
    const button = el('button','filter-chip'+(state.brand===brand?' is-active':''),brand==='all'?'Todos':brand);
    button.type='button';button.dataset.brand=brand;
    button.addEventListener('click',()=> { state.brand=brand;renderFilters();renderProducts(); });
    list.append(button);
  }
}
function visibleProducts() {
  let products = state.products.filter(p => (state.brand==='all'||p.marca===state.brand)
    && [p.marca,p.modelo,p.color,p.capacidad,p.descripcion].filter(Boolean).join(' ').toLocaleLowerCase('es-MX').includes(state.search.toLocaleLowerCase('es-MX')));
  if(state.sort==='name') products.sort((a,b)=> collator.compare(a.marca+' '+a.modelo,b.marca+' '+b.modelo));
  else if(state.sort.startsWith('price')) products.sort((a,b)=> {
    const av=a.precio_mxn==null?Number.POSITIVE_INFINITY:Number(a.precio_mxn), bv=b.precio_mxn==null?Number.POSITIVE_INFINITY:Number(b.precio_mxn);
    if(!Number.isFinite(av))return 1;if(!Number.isFinite(bv))return -1;
    return state.sort==='price-asc'?av-bv:bv-av;
  });
  else products.sort((a,b)=>(Number(b.destacado)-Number(a.destacado))||(a.orden-b.orden)||collator.compare(a.modelo,b.modelo));
  return products;
}
function cardFor(product) {
  const card = el('article','product-card product-card--v2');
  const visual=el('button','product-card__visual');visual.type='button';visual.setAttribute('aria-label',`Explorar ${product.marca} ${product.modelo}`);
  const photo=el('img');photo.loading='lazy';photo.alt=`Imagen del ${product.marca} ${product.modelo}`;image(photo,photoUrl(product),'/demo/zte-blade-a56-pendiente.svg');
  visual.append(photo);
  if (product.destacado || !product.disponible) visual.append(el('span','product-card__tag'+(!product.disponible?' product-card__tag--soldout':''),product.disponible?'DESTACADO':'AGOTADO'));
  const count=framesFor(product).length;
  visual.append(el('span','product-card__rotate', count>1?'↔ '+count+' VISTAS':'↗ VER MODELO'));
  visual.addEventListener('click',()=>openProduct(product));
  const body=el('div','product-card__body');body.append(el('span','product-card__brand',product.marca));
  body.append(el('h3','',product.modelo));
  body.append(el('p','product-card__subtitle',[product.capacidad,product.color].filter(Boolean).join(' · ') || 'Explora las características'));
  const bottom=el('div','product-card__bottom');bottom.append(el('strong','',currency(product.precio_mxn)));
  const btn=el('button','product-card__more','↗');btn.type='button';btn.setAttribute('aria-label',`Ver ${product.marca} ${product.modelo}`);btn.addEventListener('click',()=>openProduct(product));
  bottom.append(btn);body.append(bottom);card.append(visual,body);
  return card;
}
function renderProducts(){
  $('product-count').textContent=state.products.length+' '+(state.products.length===1?'modelo':'modelos')+' en catálogo';
  const root=$('product-grid');root.replaceChildren();const list=visibleProducts();
  if(!list.length){const empty=el('div','empty-state');empty.append(el('div','empty-state__icon','⌕'),el('strong','',state.products.length?'No encontramos ese modelo':'Próximamente habrá modelos'),el('p','',state.products.length?'Prueba con otra marca o nombre.':'No hay modelos publicados. Ejecuta el SQL 06_REPARAR_CATALOGO_SIN_MODELOS.sql desde Supabase para activar los siete equipos.'));root.append(empty);return;}
  for(const product of list)root.append(cardFor(product));
}
function specifications(product){
  const labels={red:'Red',camara_frontal:'Cámara frontal',camara_trasera:'Cámara trasera',pantalla:'Pantalla',procesador:'Procesador',almacenamiento:'Almacenamiento',sistema_operativo:'Sistema operativo'};
  const data=product.especificaciones && typeof product.especificaciones==='object'?product.especificaciones:{};
  let values=Object.entries(data).filter(([,v])=>v!==null&&String(v).trim());
  if(!values.length)values=String(product.descripcion||'').split(/\r?\n/).map(s=>{const pos=s.indexOf(':');return pos>0?[s.slice(0,pos).trim(),s.slice(pos+1).trim()]:null;}).filter(Boolean);
  return values.map(([k,v])=>[labels[k]||k.replaceAll('_',' ').replace(/^./,s=>s.toUpperCase()),String(v)]);
}
function whatsappLink(product){
  const number=cleanPhone(state.settings.whatsapp_numero);if(!/^\d{8,15}$/.test(number))return '';
  const name=[product.marca,product.modelo,product.capacidad].filter(Boolean).join(' ');
  const link=new URL(window.location.origin + window.location.pathname);link.searchParams.set('modelo', product.slug);
  const mensaje=`Hola, me interesa comprar el ${name} de GRIPXELL.\n\nAquí está el modelo que elegí: ${link.href}\n\n¿Me confirmas disponibilidad y precio?`;
  return `https://wa.me/${number}?text=${encodeURIComponent(mensaje)}`;
}
function clearTimer(){
  if(viewer.auto!==null){clearInterval(viewer.auto);viewer.auto=null;}
  if(viewer.rafId!==null){cancelAnimationFrame(viewer.rafId);viewer.rafId=null;viewer.rafLast=0;}
  $('turntable-card').classList.remove('is-sway');
  $('turntable-rig').classList.remove('is-spinning');
  $('detail-auto').textContent=viewer.frames.length===1?'Movimiento automático':'Giro automático';
}
function paintRig(){
  $('turntable-rig').style.transform=`translateX(-50%) rotateY(${viewer.angle}deg) rotateX(4deg)`;
  viewer.index=isBackFacing(viewer.angle)?1:0;
  $('detail-angle-label').textContent=viewer.index===1?'TAPA TRASERA · GIRO 3D':'PANTALLA · GIRO 3D';
  [...$('detail-thumbs').children].forEach((thumb,index)=>thumb.classList.toggle('is-current',index===viewer.index));
}
function paintTilt(){
  $('turntable-card').style.transform=`perspective(950px) rotateY(${viewer.tiltY}deg) rotateX(${viewer.tiltX}deg)`;
}
function drawFrame({animate=true}={}) {
  const frame=viewer.frames[viewer.index]; if(!frame)return;
  const img=$('turntable-image'),card=$('turntable-card');
  if (viewer.mode === 'rig') paintRig();
  if(viewer.mode!=='rig' && img.getAttribute('src')!==frame.src){
    img.classList.remove('turntable__image--in');
    img.src=frame.src; img.alt=`${frame.label} de ${state.current.marca} ${state.current.modelo}`;
    requestAnimationFrame(()=>img.classList.add('turntable__image--in'));
  }
  if(animate && viewer.mode!=='rig' && viewer.pointerId===null && !matchMedia('(prefers-reduced-motion: reduce)').matches){card.animate([{opacity:.78},{opacity:1}],{duration:220,easing:'ease-out'});}
  if(viewer.mode!=='rig')$('detail-angle-label').textContent=`${frame.label.toUpperCase()} · ${viewer.index+1} / ${viewer.frames.length}`;
  $('detail-prev').disabled=viewer.frames.length<2;$('detail-next').disabled=viewer.frames.length<2;
  $('detail-auto').disabled=viewer.frames.length===0;
  $('viewer-help').textContent=viewer.mode==='rig'?'Desliza a izquierda o derecha para girarlo y ver la parte trasera.':viewer.frames.length===1?'Mueve el dedo hacia los lados para inclinar la foto en 3D.':'Desliza a izquierda o derecha para cambiar de fotografía.';
  const thumbs=$('detail-thumbs');thumbs.replaceChildren();
  viewer.frames.forEach((part,i)=>{
    const b=el('button','viewer-thumb'+(i===viewer.index?' is-current':''));b.type='button';b.setAttribute('aria-label',`Ver ${part.label}`);
    const m=el('img');m.src=part.src;m.alt='';m.loading='lazy';b.append(m);b.addEventListener('click',()=>setFrame(i));thumbs.append(b);
  });
}
function setFrame(next,{animate=true}={}){if(!viewer.frames.length)return;const previous=viewer.index;viewer.index=(next+viewer.frames.length)%viewer.frames.length;if(viewer.mode==='rig' && previous!==viewer.index)viewer.angle+=((next>previous || (previous===1&&next===0))?180:-180);drawFrame({animate});}
function openProduct(product){
  clearTimer();state.current=product;
  $('detail-brand').textContent=product.marca.toUpperCase();$('dialog-title').textContent=product.modelo;
  $('detail-meta').textContent=[product.capacidad,product.color].filter(Boolean).join(' · ');
  viewer.frames=framesFor(product);viewer.index=0;viewer.pointerId=null;viewer.axis='pending';viewer.angle=0;viewer.tiltX=0;viewer.tiltY=0;
  viewer.mode=(product.foto_frontal_path && product.foto_trasera_path && !String(product.foto_frontal_path).startsWith('/demo/') && !String(product.foto_trasera_path).startsWith('/demo/') && !product.foto_lateral_derecha_path && !product.foto_lateral_izquierda_path)?'rig':viewer.frames.length>1?'frames':'single';
  $('detail-auto').textContent=viewer.frames.length===1?'Movimiento automático':'Giro automático';
  $('turntable-rig').hidden=viewer.mode!=='rig';$('turntable-card').hidden=viewer.mode==='rig';
  if(viewer.mode==='rig'){$('turntable-front').src=publicImageUrl(product.foto_frontal_path);$('turntable-back').src=publicImageUrl(product.foto_trasera_path);}
  $('detail-viewer').classList.remove('is-dragging');paintTilt();
  if(viewer.frames.length)drawFrame({animate:false});
  else { $('turntable-image').removeAttribute('src');$('detail-angle-label').textContent='Foto por agregar';}
  const spec=specifications(product);const root=$('detail-spec-list');root.replaceChildren();
  for(const [k,v] of spec){const row=el('div','spec-row');row.append(el('span','',k),el('strong','',v));root.append(row);}
  const extra=String(product.descripcion||'').split(/\r?\n/).filter(line=>!/^\s*[^:]+:\s*\S+/.test(line)).join('\n').trim();
  $('detail-description').textContent=extra;$('detail-description').hidden=!extra;
  $('detail-price').textContent=currency(product.precio_mxn);
  $('detail-availability').textContent=product.disponible?'Consulta disponibilidad':'Temporalmente agotado';
  const anchor=$('detail-whatsapp'),href=product.disponible?whatsappLink(product):'';
  if(href){anchor.href=href;anchor.removeAttribute('aria-disabled');anchor.title='';}
  else {anchor.removeAttribute('href');anchor.setAttribute('aria-disabled','true');anchor.title=product.disponible?'Configura el número de WhatsApp en Admin.':'No disponible';}
  if(!$('product-dialog').open)$('product-dialog').showModal();document.body.classList.add('dialog-open');
  const u=new URL(location.href);u.searchParams.set('modelo',product.slug);history.replaceState({},'',u);
}
function closeProduct(){clearTimer();if($('product-dialog').open)$('product-dialog').close();document.body.classList.remove('dialog-open');state.current=null;const u=new URL(location.href);u.searchParams.delete('modelo');history.replaceState({},'',u);}
async function shareProduct(){if(!state.current)return;const url=new URL(location.href);url.searchParams.set('modelo',state.current.slug);try{if(navigator.share)await navigator.share({title:`${state.current.marca} ${state.current.modelo}`,url:url.href});else{await navigator.clipboard.writeText(url.href);toast('Enlace copiado.');}}catch(err){if(err.name!=='AbortError')toast('No se pudo compartir.','error');}}
function spinRig(timestamp){
  if(viewer.rafId===null || viewer.mode!=='rig')return;
  if(viewer.rafLast) viewer.angle+=Math.min(50,timestamp-viewer.rafLast)*0.068;
  viewer.rafLast=timestamp;
  paintRig();
  viewer.rafId=requestAnimationFrame(spinRig);
}
function setAuto(){
  if(viewer.auto!==null || viewer.rafId!==null || $('turntable-card').classList.contains('is-sway')){clearTimer();return;}
  if(viewer.frames.length===1){
    $('turntable-card').classList.add('is-sway');
    $('detail-auto').textContent='Pausar movimiento';
    return;
  }
  if(viewer.mode==='rig'){
    $('turntable-rig').classList.add('is-spinning');
    $('detail-auto').textContent='Pausar giro';
    viewer.rafLast=0;
    viewer.rafId=requestAnimationFrame(spinRig);
    return;
  }
  if(viewer.frames.length<2)return;
  $('detail-auto').textContent='Pausar giro';
  viewer.auto=setInterval(()=>setFrame(viewer.index+1),1650);
}
function initViewer(){
  const stage=$('detail-viewer');
  const release=(event, cancelled=false)=>{
    if(viewer.pointerId===null || (event && event.pointerId!==viewer.pointerId))return;
    const id=viewer.pointerId;
    const dx=(event?.clientX ?? viewer.lastX)-viewer.startX;
    const dy=(event?.clientY ?? viewer.lastY)-viewer.startY;
    const isHorizontal=viewer.axis==='horizontal';
    viewer.pointerId=null;
    viewer.axis='pending';
    stage.classList.remove('is-dragging');
    if(stage.hasPointerCapture?.(id)){
      try{stage.releasePointerCapture(id);}catch{}
    }
    if(viewer.mode==='frames'){
      viewer.tiltX=0;viewer.tiltY=0;paintTilt();
      const direction=!cancelled && isHorizontal ? swipeDirection(dx,dy,viewer.pointerType) : 0;
      if(direction) setFrame(viewer.index+direction);
      $('viewer-help').textContent='Desliza a izquierda o derecha para cambiar de fotografía.';
    }
    // Una foto: conserva inclinación. Dos caras: conserva ángulo real alcanzado.
  };
  stage.addEventListener('pointerdown',e=>{
    if(!state.current || viewer.pointerId!==null)return;
    if(e.pointerType==='mouse' && e.button!==0)return;
    if(e.isPrimary===false)return;
    clearTimer();
    viewer.pointerId=e.pointerId;viewer.pointerType=e.pointerType || 'mouse';
    viewer.axis='pending';
    viewer.startX=viewer.lastX=e.clientX;viewer.startY=viewer.lastY=e.clientY;
    viewer.baseAngle=viewer.angle;
    viewer.baseTiltX=viewer.tiltX;viewer.baseTiltY=viewer.tiltY;
    try{stage.setPointerCapture?.(e.pointerId);}catch{}
  });
  stage.addEventListener('pointermove',e=>{
    if(viewer.pointerId!==e.pointerId)return;
    const dx=e.clientX-viewer.startX,dy=e.clientY-viewer.startY;
    viewer.lastX=e.clientX;viewer.lastY=e.clientY;
    if(viewer.axis==='pending')viewer.axis=gestureAxis(dx,dy);
    // No interferir con el scroll natural vertical dentro del diálogo.
    if(viewer.axis!=='horizontal')return;
    stage.classList.add('is-dragging');
    if(viewer.mode==='rig'){
      viewer.angle=rotationFromDrag(viewer.baseAngle,dx,viewer.pointerType);
      paintRig();
    }else{
      const tilt=tiltFromDrag(viewer.baseTiltY,viewer.baseTiltX,dx,dy,viewer.pointerType);
      viewer.tiltY=tilt.y;viewer.tiltX=tilt.x;
      paintTilt();
    }
  });
  stage.addEventListener('pointerup',e=>release(e));
  stage.addEventListener('pointercancel',e=>release(e,true));
  stage.addEventListener('lostpointercapture',e=>release(e,true));
  stage.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){
      e.preventDefault();clearTimer();
      if(viewer.mode==='single'){
        viewer.tiltY=Math.max(-32,Math.min(32,viewer.tiltY+(e.key==='ArrowRight'?12:-12)));
        paintTilt();
      }else setFrame(viewer.index+(e.key==='ArrowRight'?1:-1));
    }
  });
  $('detail-prev').addEventListener('click',()=>{clearTimer();setFrame(viewer.index-1);});
  $('detail-next').addEventListener('click',()=>{clearTimer();setFrame(viewer.index+1);});
  $('detail-auto').addEventListener('click',setAuto);
}
function applyCustomLogo(path){const src=publicImageUrl(path);if(!src)return;for(const mark of document.querySelectorAll('.brand__mark')){const img=el('img');img.src=src;img.alt='';img.style.cssText='width:100%;height:100%;object-fit:contain;position:relative;z-index:2';mark.replaceChildren(img);}}
async function loadCatalog(){
 try{
  const client=supabase();const [p,s]=await Promise.all([
    client.from(TABLES.products).select('*').eq('publicado',true).order('orden',{ascending:true}),
    client.from(TABLES.settings).select('*').eq('id',1).maybeSingle()
  ]);
  // Si la configuración de WhatsApp falla, el catálogo de productos debe seguir visible.
  if(p.error)throw p.error;
  if(s.error)console.warn('GRIPXELL: no se pudo cargar la configuración de la tienda:',s.error);
  state.products=p.data||[];state.settings=s.error?{}:(s.data||{});
  renderFilters();renderProducts();if(state.settings.logo_path)applyCustomLogo(state.settings.logo_path);
  const wanted=new URL(location.href).searchParams.get('modelo');if(wanted){const found=state.products.find(x=>x.slug===wanted);if(found)openProduct(found);}
 }catch(error){console.error('GRIPXELL',error);$('product-count').textContent='Sin conexión';const root=$('product-grid');root.replaceChildren();const box=el('div','empty-state');box.append(el('strong','', 'No se pudo cargar el catálogo'),el('p','', 'Verifica que ejecutaste los SQL 01 y 04 y configuraste las claves públicas de Supabase.'));root.append(box);}
}
function init(){
 $('footer-year').textContent=new Date().getFullYear();initViewer();
 $('catalog-search').addEventListener('input',e=>{state.search=e.target.value;renderProducts();});
 $('catalog-sort').addEventListener('change',e=>{state.sort=e.target.value;renderProducts();});
 $('dialog-close').addEventListener('click',closeProduct);
 $('product-dialog').addEventListener('click',e=>{if(e.target===$('product-dialog'))closeProduct();});
 $('product-dialog').addEventListener('cancel',e=>{e.preventDefault();closeProduct();});
 $('share-product').addEventListener('click',shareProduct);void loadCatalog();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
