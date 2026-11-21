/** Recorte local del equipo: quita blanco exterior y texto aislado; nunca altera el original. */
const validTypes = new Set(['image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif']);
function nearWhite(data, pos) {
  const r=data[pos], g=data[pos+1], b=data[pos+2];
  return r>236&&g>236&&b>236 && Math.max(r,g,b)-Math.min(r,g,b)<28;
}
function areaStats(mask, w, h, fromPhoneSheet) {
  if (!fromPhoneSheet) return mask;
  const labels=new Uint8Array(w*h); // 1 exterior, 2 kept
  const queue=new Int32Array(w*h);
  for (let pos=0;pos<mask.length;pos++) {
    if (!mask[pos] || labels[pos]) continue;
    let head=0, tail=0, left=w, right=0, top=h, bottom=0;
    queue[tail++]=pos; labels[pos]=1;
    while(head<tail) {
      const p=queue[head++], x=p%w, y=(p/w)|0;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      if(x>0){const n=p-1;if(mask[n]&&!labels[n]){labels[n]=1;queue[tail++]=n;}}
      if(x<w-1){const n=p+1;if(mask[n]&&!labels[n]){labels[n]=1;queue[tail++]=n;}}
      if(y>0){const n=p-w;if(mask[n]&&!labels[n]){labels[n]=1;queue[tail++]=n;}}
      if(y<h-1){const n=p+w;if(mask[n]&&!labels[n]){labels[n]=1;queue[tail++]=n;}}
    }
    // Los teléfonos son figuras altas o masas grandes; el texto aislado no.
    if(bottom-top>h*.28 && tail>w*h*.002 || tail>w*h*.06) {
      for(let i=0;i<tail;i++)labels[queue[i]]=2;
    }
  }
  for(let i=0;i<mask.length;i++) if(labels[i]!==2)mask[i]=0;
  return mask;
}
async function bitmapFor(file) {
  if(!validTypes.has(file.type))throw new Error('Selecciona una imagen JPG, PNG, WebP, AVIF o HEIC compatible.');
  if(file.size>24*1024*1024)throw new Error('La imagen supera el máximo de 24 MB.');
  try { return {bitmap:await createImageBitmap(file), url:null}; }
  catch {
    const url=URL.createObjectURL(file), bitmap=new Image();bitmap.src=url;
    try {await bitmap.decode();return {bitmap,url};}catch {URL.revokeObjectURL(url);throw new Error('No se pudo abrir la foto. Si es HEIC, expórtala como JPG.');}
  }
}
export async function isHorizontalSheet(file) {
 const {bitmap,url}=await bitmapFor(file);
 const result=bitmap.width/bitmap.height>1.48;
 if(typeof bitmap.close==='function')bitmap.close();if(url)URL.revokeObjectURL(url);
 return result;
}
export async function recortarTelefonoPNG(file,{isSheet=false,cropPercent=62,maxDimension=1500,removeWhite=true}={}) {
  const {bitmap,url}=await bitmapFor(file);
  try {
    let sx=0, sy=0, sw=bitmap.width, sh=bitmap.height;
    if(isSheet && bitmap.width / bitmap.height>1.48){
      // Descarta encabezado del proveedor y publicidad inferior.
      sx=Math.round(bitmap.width*.01);sy=Math.round(bitmap.height*.125);
      sw=Math.round(bitmap.width*Math.min(.78,Math.max(.38,Number(cropPercent)/100)))-sx;
      sh=Math.round(bitmap.height*.76);
    }
    const scale=Math.min(1,maxDimension/Math.max(sw,sh));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
    const context=canvas.getContext('2d',{willReadFrequently:true}); if(!context)throw new Error('El navegador no permite procesar esta fotografía.');
    context.imageSmoothingQuality='high';context.drawImage(bitmap,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    if(removeWhite){
      const {width:w,height:h}=canvas;
      const image=context.getImageData(0,0,w,h), data=image.data;
      const white=new Uint8Array(w*h), exterior=new Uint8Array(w*h), queue=new Int32Array(w*h);
      for(let i=0;i<white.length;i++)white[i]=nearWhite(data,i*4)?1:0;
      let head=0,tail=0;
      function add(p){if(white[p]&&!exterior[p]){exterior[p]=1;queue[tail++]=p;}}
      for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
      for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
      while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;
        if(x>0)add(p-1);if(x+1<w)add(p+1);if(y>0)add(p-w);if(y+1<h)add(p+w);
      }
      const foreground=new Uint8Array(w*h);
      for(let i=0;i<foreground.length;i++)foreground[i]=exterior[i]?0:1;
      areaStats(foreground,w,h,isSheet);
      let minX=w,minY=h,maxX=0,maxY=0,count=0;
      for(let i=0;i<foreground.length;i++){
        const at=i*4;
        if(!foreground[i])data[at+3]=0;
        else { const x=i%w,y=(i/w)|0;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++; }
      }
      context.putImageData(image,0,0);
      if(count>w*h*.01){
        const pad=Math.round(Math.min(w,h)*.035);
        const x=Math.max(0,minX-pad),y=Math.max(0,minY-pad);
        const cw=Math.min(w-x,maxX-minX+1+pad*2),ch=Math.min(h-y,maxY-minY+1+pad*2);
        const trimmed=document.createElement('canvas');trimmed.width=cw;trimmed.height=ch;
        trimmed.getContext('2d').drawImage(canvas,x,y,cw,ch,0,0,cw,ch);
        return await asPng(trimmed);
      }
    }
    return await asPng(canvas);
  } finally {if(typeof bitmap.close==='function')bitmap.close();if(url)URL.revokeObjectURL(url);}
}
async function asPng(canvas){
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob)throw new Error('No se pudo generar PNG transparente.');
 if(blob.size>8*1024*1024)throw new Error('El PNG supera los 8 MB. Sube una imagen más pequeña.');
 return blob;
}
