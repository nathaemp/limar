/* Paraty Waters · pop-ups do Lima Acervo e do Lima Hub.
   Ao entrar no app (logo depois do login ou ao abrir o app já logado), mostra todos os
   pop-ups ativos, um depois do outro: só dá para usar o app depois de fechar todos.
   A partir daí, a cada X minutos de uso (definido no admin) mostra de novo todos os ligados,
   nunca durante uma viagem no velocímetro nem com outra janela aberta. */
(function(){
'use strict';
const KEY='pw-pop',CACHE='pw-pop-cache',FIRST_DELAY=3*60e3;
let shownThisSession=false;
const ls={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
let items=ls.get(CACHE,{list:[],every:15,enabled:true});
let usedMs=0,lastTick=Date.now();
const st=ls.get(KEY,{lastShown:0,lastKind:'hub',idx:{acervo:0,hub:0}});

const css=document.createElement('style');css.textContent=`
#pw-pop{position:fixed;inset:0;z-index:9000;display:grid;place-items:end center;background:rgba(4,22,27,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:pwp-in .25s ease-out}
#pw-pop .card{width:min(440px,100%);margin:0 auto;background:#0f242b;color:#e6f1f1;border-radius:24px 24px 0 0;overflow:hidden;box-shadow:0 -10px 40px rgba(0,0,0,.4);animation:pwp-up .35s cubic-bezier(.2,.9,.3,1);padding-bottom:env(safe-area-inset-bottom,0px)}
@media (min-width:600px){#pw-pop{place-items:center}#pw-pop .card{border-radius:24px}}
#pw-pop .media{position:relative;background:#08171c;aspect-ratio:4/5;max-height:58dvh;width:100%}
#pw-pop .media video,#pw-pop .media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#pw-pop .media .ph{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(120% 90% at 50% 20%,#0f5a6b,#08171c);font:700 1.5rem system-ui;color:#fff;text-align:center;padding:20px}
#pw-pop .x{position:absolute;top:10px;right:10px;width:38px;height:38px;border-radius:50%;border:0;background:rgba(0,0,0,.5);color:#fff;font-size:1.3rem;line-height:1;cursor:pointer;z-index:2}
#pw-pop .badge{position:absolute;left:12px;top:12px;z-index:2;font:700 .68rem system-ui;letter-spacing:.14em;text-transform:uppercase;background:#e9b949;color:#1d1606;padding:5px 9px;border-radius:99px}
#pw-pop .tx{padding:16px 18px 18px;display:grid;gap:8px}
#pw-pop h3{font:700 1.2rem/1.2 system-ui;margin:0}
#pw-pop p{margin:0;color:#a9c3c7;font-size:.92rem;line-height:1.45}
#pw-pop .go{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px;height:50px;border-radius:99px;background:#4fb3c6;color:#04161b;font:700 1rem system-ui;text-decoration:none}
#pw-pop .later{background:none;border:0;color:#8fa9ae;font:500 .85rem system-ui;padding:6px;cursor:pointer}
@keyframes pwp-in{from{opacity:0}}@keyframes pwp-up{from{transform:translateY(40px);opacity:.4}}
`;document.head.appendChild(css);

async function load(){
  const sb=window.LM_SB;if(!sb)return;
  try{
    const [p,s]=await Promise.all([
      sb.from('popups').select('id,kind,title,body,video_path,poster_path,cta_label,cta_url,position').eq('active',true).order('position'),
      sb.from('popup_settings').select('every_minutes,enabled').eq('id',1).maybeSingle()
    ]);
    if(p.error)return;
    items={list:(p.data||[]).map(x=>({...x,video:x.video_path?pub(x.video_path):null,poster:x.poster_path?pub(x.poster_path):null})),every:(s.data&&s.data.every_minutes)||15,enabled:s.data?s.data.enabled:true};
    ls.set(CACHE,items);
  }catch(e){}
}
function pub(path){try{return window.LM_SB.storage.from('popups').getPublicUrl(path).data.publicUrl}catch(e){return null}}

function busy(){
  if(document.visibilityState!=='visible')return true;
  if(document.documentElement.classList.contains('locked'))return true;
  if(document.getElementById('pw-pop')||document.getElementById('splash'))return true;
  if(document.querySelector('dialog[open]'))return true;
  const adm=document.getElementById('admin');if(adm&&!adm.hidden)return true;
  if(typeof window.PW_TRIP==='function'&&window.PW_TRIP())return true; // viagem ativa no velocímetro
  const nav=document.getElementById('v-navegar');if(nav&&!nav.hidden)return true;
  return false;
}

function next(){
  const kinds=['acervo','hub'];
  let kind=st.lastKind==='acervo'?'hub':'acervo';
  for(let t=0;t<2;t++){
    const list=items.list.filter(x=>x.kind===kind);
    if(list.length){const i=(st.idx[kind]||0)%list.length;st.idx[kind]=i+1;st.lastKind=kind;return list[i]}
    kind=kinds.find(k=>k!==kind);
  }
  return null;
}

function show(it,onClose){
  const track=(t)=>{try{window.LM_TRACK&&window.LM_TRACK('clique','popup-'+it.kind+'-'+t)}catch(e){}};
  const d=document.createElement('div');d.id='pw-pop';d.setAttribute('role','dialog');d.setAttribute('aria-label',it.title||'Novidade');
  const label=it.cta_label||(it.kind==='acervo'?'Baixar no Lima Acervo':'Abrir o Lima Hub');
  const media=it.video
    ?`<video src="${esc(it.video)}" ${it.poster?`poster="${esc(it.poster)}"`:''} autoplay muted loop playsinline preload="auto" disablepictureinpicture controlslist="nodownload"></video>`
    :it.poster?`<img src="${esc(it.poster)}" alt="">`:`<div class="ph">${esc(it.title||'')}</div>`;
  d.innerHTML=`<div class="card"><div class="media">${media}<span class="badge">${it.kind==='acervo'?'Lima Acervo':'Lima Hub'}</span><button type="button" class="x" aria-label="Fechar">×</button></div>
    <div class="tx">${it.title?`<h3>${esc(it.title)}</h3>`:''}${it.body?`<p>${esc(it.body)}</p>`:''}
    <a class="go" href="${esc(it.cta_url||'#')}" target="_blank" rel="noopener">${it.kind==='acervo'?'⬇ ':''}${esc(label)}</a>
    <button type="button" class="later">Agora não</button></div></div>`;
  const close=()=>{if(!d.isConnected)return;d.remove();if(onClose)onClose()};
  d.addEventListener('click',e=>{if(e.target===d)close()});
  d.querySelector('.x').onclick=()=>{track('fechar');close()};
  d.querySelector('.later').onclick=()=>{track('fechar');close()};
  d.querySelector('.go').onclick=()=>{track('cta');setTimeout(close,300)};
  const v=d.querySelector('video');if(v)v.addEventListener('contextmenu',e=>e.preventDefault());
  document.body.appendChild(d);track('visto');
  st.lastShown=Date.now();ls.set(KEY,st);usedMs=0;shownThisSession=true;
}

/* ---------- ao entrar no app: todos os pop-ups ativos, em sequência ---------- */
let entryDone=false,entryRunning=false,loaded=false;
function canEnter(){
  if(document.visibilityState!=='visible')return false;
  if(document.documentElement.classList.contains('locked'))return false;   // ainda na tela de entrar
  if(document.getElementById('pw-pop')||document.getElementById('splash'))return false;  // vinheta de abertura
  const adm=document.getElementById('admin');if(adm&&!adm.hidden)return false;
  return true;
}
function entryTick(){
  if(entryDone||entryRunning)return;
  if(!loaded&&!items.list.length)return;            // espera a lista chegar
  if(!items.enabled||!items.list.length){if(loaded)entryDone=true;return}
  if(!canEnter())return;
  entryRunning=true;
  sequencia(()=>{entryRunning=false;entryDone=true});
}
/* mostra um de cada tipo ligado (Acervo e depois Hub), um depois do outro; a pessoa fecha todos */
let seqRunning=false;
function sequencia(fim){
  seqRunning=true;
  const fila=['acervo','hub'].map(k=>{const l=items.list.filter(x=>x.kind===k);if(!l.length)return null;const i=(st.idx[k]||0)%l.length;st.idx[k]=i+1;return l[i]}).filter(Boolean);
  const proximo=()=>{
    const it=fila.shift();
    if(!it){seqRunning=false;st.lastShown=Date.now();ls.set(KEY,st);usedMs=0;shownThisSession=true;if(fim)fim();return}
    show(it,proximo);
  };
  proximo();
}

function tick(){
  if(!entryDone)return;                              // os minutos só contam depois dos pop-ups de entrada
  const now=Date.now(),dt=Math.min(now-lastTick,5e3);lastTick=now;
  if(document.visibilityState==='visible')usedMs+=dt;
  if(!items.enabled||!items.list.length)return;
  const every=(items.every||15)*60e3;
  // 1º pop-up depois de 3 min de uso; depois, a cada "every" minutos de uso.
  // E nunca antes de "every" minutos desde o último (mesmo fechando e abrindo o app).
  const need=shownThisSession?every:FIRST_DELAY;
  const sinceLast=st.lastShown?now-st.lastShown:Infinity;
  const ready=usedMs>=need&&sinceLast>=every;
  if(ready&&!seqRunning&&!busy())sequencia();   // a cada intervalo: todos os ligados, um depois do outro
}
let started=false;
function start(){if(started)return;started=true;
  load().finally(()=>{loaded=true;entryTick()});
  const ent=setInterval(()=>{entryTick();if(entryDone)clearInterval(ent)},700);
  setInterval(tick,5e3);setInterval(load,30*60e3)}
if(window.LM_SB)start();else window.addEventListener('load',()=>setTimeout(start,500));
window.PW_POPUP_TEST=()=>{const it=next();if(it)show(it)};
window.PW_POPUP_SHOW=(it)=>show({...it,video:it.video_path?pub(it.video_path):null,poster:it.poster_path?pub(it.poster_path):null});
window.PW_POPUP_RELOAD=load;
})();
