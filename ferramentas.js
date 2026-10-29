/* Paraty Waters · ferramentas de navegação
   Pontos dos barqueiros (com alerta de perigo), medir distância, ir até, rota planejada com
   combustível, diário de viagens com GPX, alarme de âncora, homem ao mar, localização ao vivo,
   modo noturno e vento sobre a carta. Usa as funções do script principal (Carta, PLACES, hav...). */
(function(){
'use strict';
if(typeof Carta==='undefined')return;
const NM=1852;
const now=()=>Date.now();
const dtxt=nm=>nm==null||isNaN(nm)?'—':nm<0.54?Math.round(nm*NM)+' m':fmt(nm,nm<10?2:1)+' mn';
const rumo=b=>b==null?'—':String(Math.round(b)%360).padStart(3,'0')+'° '+dirTxt(b);
const hm=min=>{if(min==null||!isFinite(min))return '—';min=Math.round(min);const h=Math.floor(min/60),m=min%60;return h?h+' h '+String(m).padStart(2,'0'):m+' min'};
const clock=t=>new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:TZ}).format(new Date(t));
const track=(t,d)=>{try{window.LM_TRACK&&LM_TRACK(t,d)}catch(e){}};
const vis=id=>{const e=$(id);return e&&!e.hidden};

/* ---------- som e vibração ---------- */
let AC=null;
function unlockAudio(){try{if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(C)AC=new C()}if(AC&&AC.state==='suspended')AC.resume()}catch(e){}}
document.addEventListener('pointerdown',unlockAudio,{passive:true});
function beep(n=3,f=880,len=0.18){try{unlockAudio();if(!AC)return;let t=AC.currentTime+0.02;
  for(let i=0;i<n;i++){const o=AC.createOscillator(),g=AC.createGain();o.type='square';o.frequency.value=f;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.5,t+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+len);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+len+0.02);t+=len+0.12}}catch(e){}}
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
let wl=null;async function awake(on){try{if(on){if(!wl&&'wakeLock' in navigator){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}}else if(wl){wl.release();wl=null}}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&(Anc.on||Nav.alvo))awake(true)});

/* ---------- elementos da interface ---------- */
const mapEl=$('map');
mapEl.insertAdjacentHTML('beforeend',`<svg class="ov" id="ov" aria-hidden="true"></svg><div class="ovmk" id="ovmk"></div>
  <div class="mapbtns2"><button type="button" id="m-night" aria-label="Modo noturno" title="Modo noturno">🌙</button><button type="button" id="m-vento" aria-label="Mostrar vento na carta" title="Vento na carta">≋</button></div>
  <div class="maphint" id="maphint" hidden></div>`);
const seg=document.querySelector('#v-carta .seg');
seg.insertAdjacentHTML('afterend',`<div class="tools" role="group" aria-label="Ferramentas da carta">
  <button type="button" data-t="marcar" aria-pressed="false">📍 Marcar</button>
  <button type="button" data-t="ir" aria-pressed="false">🧭 Ir até</button>
  <button type="button" data-t="rota" aria-pressed="false">🛣️ Rota</button>
  <button type="button" data-t="medir" aria-pressed="false">📏 Medir</button>
  <button type="button" data-t="ancora" aria-pressed="false">⚓ Âncora</button>
  <button type="button" class="mob" id="t-mob">🆘 Homem ao mar</button>
</div>`);
mapEl.insertAdjacentHTML('afterend',`<div class="panel tpanel" id="tp" hidden></div>`);
document.body.insertAdjacentHTML('beforeend',`<div id="pw-nav" hidden><div class="in"><div class="arw"><svg viewBox="0 0 24 24"><path d="M12 2 19 21 12 16.5 5 21Z" fill="#e9b949"/></svg></div>
  <div style="min-width:0"><div class="t" id="nv-t"></div><div class="v" id="nv-v"></div></div><div class="acts"><button type="button" id="nv-map" aria-label="Ver na carta">🗺️</button><button type="button" id="nv-x" aria-label="Encerrar">×</button></div></div></div>
<div id="pw-alert" hidden><div class="in" role="alert"><span class="ic" id="al-ic">⚠️</span><div id="al-t"></div><button type="button" id="al-x">OK</button></div></div>
<div id="pw-alarm" hidden role="alertdialog" aria-label="Alarme"><div><div style="font-size:3rem">⚓</div><h2 id="am-t">Âncora garrando!</h2><div class="big" id="am-d"></div><p id="am-s" style="margin:0 0 14px"></p>
  <div><button type="button" id="am-snooze">Silenciar 2 min</button></div><div><button type="button" class="ghost" id="am-off">Desligar o alarme</button></div></div></div>`);
const tp=$('tp');

/* ---------- GPS compartilhado das ferramentas ---------- */
const Geo={fix:null,watch:null,subs:[],err:null,
  need(){return (typeof PW_TRIP==='function'&&PW_TRIP())||!!Nav.alvo||Anc.on||Live.on||(vis('v-carta')&&document.visibilityState==='visible')||Geo.wait},
  tick(){const n=Geo.need();
    if(n&&Geo.watch==null&&'geolocation' in navigator)Geo.watch=navigator.geolocation.watchPosition(Geo.on,e=>{Geo.err=e.code},{enableHighAccuracy:true,maximumAge:1500,timeout:20000});
    else if(!n&&Geo.watch!=null){navigator.geolocation.clearWatch(Geo.watch);Geo.watch=null}},
  on(p){const c=p.coords,prev=Geo.fix,cur={lat:c.latitude,lon:c.longitude};
    let v=(c.speed!=null&&c.speed>=0)?c.speed*1.943844:null,h=(c.heading!=null&&!isNaN(c.heading))?c.heading:null;
    if(prev&&(v==null||h==null)){const dt=(p.timestamp-prev.t)/36e5,d=hav(prev,cur);if(dt>0&&d*NM>Math.max(4,c.accuracy*0.3)){if(v==null)v=d/dt;if(h==null)h=bearing(prev,cur)}}
    const spd=v==null?(prev?prev.spd:0):(prev&&prev.spd?prev.spd*0.5+v*0.5:v);
    Geo.fix={lat:cur.lat,lon:cur.lon,acc:c.accuracy,t:p.timestamp,spd:spd<0.3?0:spd,hdg:h??(prev?prev.hdg:null)};Geo.err=null;
    Geo.subs.forEach(f=>{try{f(Geo.fix)}catch(e){}});Geo.wait=false;redraw()},
  best(){const f=Geo.fix;if(f&&now()-f.t<120e3)return f;const lf=store.get('np-lastfix',null);return lf?{lat:lf.lat,lon:lf.lon,acc:999,t:lf.t,spd:0,hdg:null,old:true}:null}
};
setInterval(Geo.tick,1500);
const redraw=()=>{try{Carta.req()}catch(e){}};

/* ---------- aviso no topo ---------- */
let alT=0;
function alerta(html,ok,secs=12){$('al-t').innerHTML=html;$('al-ic').textContent=ok?'✅':'⚠️';$('pw-alert').querySelector('.in').classList.toggle('ok',!!ok);$('pw-alert').hidden=false;clearTimeout(alT);alT=setTimeout(()=>$('pw-alert').hidden=true,secs*1000)}
$('al-x').onclick=()=>{$('pw-alert').hidden=true};

/* =====================================================================
   PONTOS DOS BARQUEIROS
   ===================================================================== */
const TIPOS={perigo:['⚠️','Perigo (laje, pedra)'],raso:['🟫','Raso / banco de areia'],fundeio:['⚓','Bom para fundear'],combustivel:['⛽','Combustível'],
  comida:['🍽️','Restaurante / quiosque'],pier:['🛟','Píer, cais ou marina'],mergulho:['🤿','Mergulho'],pesca:['🎣','Pesca'],outro:['📍','Outro']};
const PERIGO=new Set(['perigo','raso']);
const Pts={local:store.get('pw-pts',[]),com:store.get('pw-pts-com',[]),uid:null,ok:null,
  all(){return [...Pts.local.map(p=>({...p,local:true})),...Pts.com]},
  async load(){const sb=window.LM_SB;if(!sb)return;
    try{const s=await sb.auth.getSession();Pts.uid=s&&s.data&&s.data.session?s.data.session.user.id:null;
      const {data,error}=await sb.from('pontos').select('id,tipo,nome,descricao,lat,lon,status,autor').neq('status','recusado').limit(2000);
      if(error){Pts.ok=false;return}Pts.ok=true;
      Pts.com=(data||[]).map(p=>({...p,id:'c'+p.id,dbid:p.id,meu:p.autor===Pts.uid,pend:p.status!=='aprovado'}));store.set('pw-pts-com',Pts.com);buildMk();redraw()}catch(e){}},
  saveLocal(){store.set('pw-pts',Pts.local);buildMk();redraw()}
};
setTimeout(()=>Pts.load(),2500);setInterval(()=>{if(document.visibilityState==='visible')Pts.load()},15*60e3);
window.addEventListener('online',()=>Pts.load());

const ovmk=$('ovmk');
function buildMk(){ovmk.innerHTML=Pts.all().map(p=>`<div class="mk2 ${p.tipo}${p.pend?' pend':''}${p.local?' loc':''}" data-id="${esc(p.id)}">${(TIPOS[p.tipo]||TIPOS.outro)[0]}<span>${esc(p.nome)}</span></div>`).join('')
  +`<div class="mk2" data-id="__mob" style="display:none;background:#c0392b;border-color:#fff;color:#fff">🆘<span>Homem ao mar</span></div>`}
buildMk();

function ptSheet(p){
  const f=Geo.best(),d=f?hav(f,p):null,b=f?bearing(f,p):null,T=TIPOS[p.tipo]||TIPOS.outro;
  const st=p.local?'Só neste celular':p.pend?(p.meu?'Enviado · aguardando aprovação':'Aguardando aprovação'):'Ponto dos barqueiros';
  sheet(`<div class="hd"><div><div class="eyebrow">${T[0]} ${esc(T[1])} · ${st}</div><h2 id="pl-name">${esc(p.nome)}</h2></div><button type="button" class="ghost x" data-x aria-label="Fechar">×</button></div>
    ${p.descricao?`<p style="margin:0">${esc(p.descricao)}</p>`:''}
    <div class="grid2"><div class="cell"><span>Distância</span><b>${dtxt(d)}</b></div><div class="cell"><span>Rumo</span><b>${rumo(b)}</b></div></div>
    <div class="cell"><span>Posição</span><b>${dm(p.lat,'N','S')}  ${dm(p.lon,'L','O')}</b></div>
    <div class="row"><button type="button" id="ps-go">🧭 Ir até aqui</button>${(p.local||p.meu)?`<button type="button" class="ghost" id="ps-del">Apagar</button>`:''}</div>
    ${p.local&&Pts.ok!==false?`<button type="button" class="ghost" id="ps-share">Enviar para os barqueiros</button>`:''}
    <span class="legend" id="ps-msg"></span>`);
  $('ps-go').onclick=()=>{closeSheet();Nav.start({n:p.nome,lat:p.lat,lon:p.lon})};
  if($('ps-del'))$('ps-del').onclick=async()=>{
    if(p.local){Pts.local=Pts.local.filter(x=>x.id!==p.id);Pts.saveLocal();closeSheet();return}
    const {error}=await LM_SB.from('pontos').delete().eq('id',p.dbid);if(error){$('ps-msg').textContent='Não consegui apagar agora (sem internet?).';return}
    Pts.com=Pts.com.filter(x=>x.id!==p.id);store.set('pw-pts-com',Pts.com);buildMk();redraw();closeSheet()};
  if($('ps-share'))$('ps-share').onclick=async()=>{const r=await enviaPonto(p);if(r.ok){Pts.local=Pts.local.filter(x=>x.id!==p.id);Pts.saveLocal();closeSheet();alerta('Ponto enviado. Ele aparece para todos depois da aprovação.',true,6)}else $('ps-msg').textContent=r.msg};
}
async function enviaPonto(p){
  if(!window.LM_SB)return {ok:false,msg:'Entre na sua conta para enviar.'};
  try{const {data,error}=await LM_SB.from('pontos').insert({tipo:p.tipo,nome:p.nome.slice(0,60),descricao:(p.descricao||'').slice(0,400)||null,lat:p.lat,lon:p.lon}).select('id,status').single();
    if(error)throw error;track('clique','ponto-enviado');Pts.load();return {ok:true,status:data.status}}
  catch(e){const m=(e&&e.message)||'';return {ok:false,msg:/fetch|network|Load failed/i.test(m)?'Sem internet. O ponto ficou salvo neste celular; envie depois.':/aprova/i.test(m)?m:'Não consegui enviar agora. O ponto ficou salvo neste celular.'}}
}
function novoPonto(lat,lon){
  const opts=Object.entries(TIPOS).map(([k,[i,n]])=>`<option value="${k}">${i} ${esc(n)}</option>`).join('');
  sheet(`<div class="hd"><div><div class="eyebrow">Novo ponto · ${dm(lat,'N','S')} ${dm(lon,'L','O')}</div><h2 id="pl-name">Marcar ponto</h2></div><button type="button" class="ghost x" data-x aria-label="Fechar">×</button></div>
    <div class="fsheet" style="display:grid;gap:10px">
      <label class="f">Tipo<select id="np-tipo">${opts}</select></label>
      <label class="f">Nome<input type="text" id="np-nome" maxlength="60" placeholder="Ex.: Laje do Pico, fundeio da Lula"></label>
      <label class="f">Detalhes (opcional)<textarea id="np-desc" maxlength="400" placeholder="Ex.: aparece na maré baixa; passar pelo lado da ilha"></textarea></label>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:.92rem"><input type="checkbox" id="np-share" style="width:auto;margin-top:3px" checked> <span>Enviar para os barqueiros. Depois de aprovado, aparece para todos e entra nos alertas de perigo.</span></label>
    </div>
    <div class="row"><button type="button" id="np-ok">Salvar ponto</button><button type="button" class="ghost" data-x>Cancelar</button></div>
    <span class="legend" id="np-msg"></span>`);
  $('np-ok').onclick=async()=>{
    const nome=$('np-nome').value.trim();if(!nome){$('np-msg').textContent='Dê um nome ao ponto.';$('np-nome').focus();return}
    const p={id:'l'+now(),tipo:$('np-tipo').value,nome,descricao:$('np-desc').value.trim(),lat:+lat.toFixed(6),lon:+lon.toFixed(6)};
    $('np-ok').disabled=true;
    if($('np-share').checked){const r=await enviaPonto(p);
      if(r.ok){closeSheet();alerta(r.status==='aprovado'?'Ponto publicado para todos.':'Ponto enviado. Ele aparece para todos depois da aprovação.',true,6);setMode(null);return}
      $('np-msg').textContent=r.msg}
    Pts.local.push(p);Pts.saveLocal();track('clique','ponto-local');
    if(!$('np-share').checked){closeSheet();alerta('Ponto salvo neste celular.',true,4);setMode(null)}
    else setTimeout(()=>{closeSheet();setMode(null)},1800)};
}

/* alerta ao chegar perto de perigo */
const ALERTA_M=150,avisados=new Map();
Geo.subs.push(f=>{
  if(!(typeof PW_TRIP==='function'&&PW_TRIP())&&!Nav.alvo&&f.spd<2)return;
  if(f.acc>80)return;
  for(const p of Pts.all()){if(!PERIGO.has(p.tipo)||(p.pend&&!p.meu))continue;
    const d=hav(f,p)*NM;if(d>ALERTA_M)continue;
    const k=p.id,t=avisados.get(k);if(t&&now()-t<10*60e3)continue;avisados.set(k,now());
    alerta(`${esc(p.nome)} a ${Math.round(d)} m<small>${esc((TIPOS[p.tipo]||TIPOS.outro)[1])} · rumo ${rumo(bearing(f,p))}${p.descricao?' · '+esc(p.descricao):''}</small>`,false,15);
    vib([400,150,400,150,400]);beep(3,990);track('clique','alerta-perigo');break}
});

/* =====================================================================
   IR ATÉ (e navegar uma rota ponto a ponto)
   ===================================================================== */
const Nav={alvo:store.get('pw-nav',null),
  start(a,rota){Nav.alvo={n:a.n||'Ponto marcado',lat:a.lat,lon:a.lon,mob:!!a.mob,t0:now(),rota:rota||null,i:rota?rota.i:0,chegou:0};store.set('pw-nav',Nav.alvo);awake(true);Geo.wait=true;Geo.tick();Nav.draw();redraw();track('clique',a.mob?'homem-ao-mar':rota?'navegar-rota':'ir-ate')},
  stop(){Nav.alvo=null;store.set('pw-nav',null);document.body.classList.remove('navon');if(!Anc.on)awake(false);$('pw-nav').hidden=true;Mob.hide();redraw()},
  draw(){const a=Nav.alvo,box=$('pw-nav');document.body.classList.toggle('navon',!!a);if(!a){box.hidden=true;return}
    box.hidden=false;box.classList.toggle('mob',!!a.mob);
    const f=Geo.best();
    let t=(a.mob?'🆘 Homem ao mar · ':a.rota?`Rota · ponto ${a.i+1} de ${a.rota.pts.length} · `:'Ir até · ')+a.n;
    if(a.mob)t+=' · há '+hm((now()-a.t0)/60000);
    $('nv-t').textContent=t;
    if(!f){$('nv-v').innerHTML='Procurando GPS…';return}
    const d=hav(f,a),b=bearing(f,a),eta=f.spd>=1.5?d/f.spd*60:null;
    let resto='';if(a.rota){let s=d;for(let k=a.i;k<a.rota.pts.length-1;k++)s+=hav(a.rota.pts[k],a.rota.pts[k+1]);resto=` <small>· rota toda ${dtxt(s)}</small>`}
    $('nv-v').innerHTML=`${dtxt(d)} · ${rumo(b)}<br><small>${eta!=null?'chega '+clock(now()+eta*60000)+' ('+hm(eta)+')':'parado'}${f.old?' · posição antiga':''}</small>${resto}`;
    const rel=(f.hdg!=null&&f.spd>1.5)?b-f.hdg:b;box.querySelector('.arw svg').style.transform=`rotate(${rel}deg)`;
    box.querySelector('.arw').title=f.hdg!=null&&f.spd>1.5?'Seta em relação à proa':'Seta em relação ao norte';
  }
};
if(Nav.alvo&&Nav.alvo.mob)Nav.alvo.t0=Nav.alvo.t0||now();
Geo.subs.push(f=>{const a=Nav.alvo;if(!a)return;Nav.draw();if(a.mob)return;
  const d=hav(f,a)*NM;
  if(d<Math.max(40,Math.min(f.acc,80))&&!a.chegou){a.chegou=now();vib([200,100,200]);beep(2,660,.25);
    if(a.rota&&a.i<a.rota.pts.length-1){a.i++;const p=a.rota.pts[a.i];alerta(`Ponto ${a.i} alcançado. Próximo: ${esc(p.n||'ponto '+(a.i+1))}`,true,6);Object.assign(a,{n:p.n||'Ponto '+(a.i+1),lat:p.lat,lon:p.lon,chegou:0});store.set('pw-nav',a);Nav.draw();redraw()}
    else{alerta(`Chegou em ${esc(a.n)}.`,true,8);setTimeout(()=>{if(Nav.alvo===a)Nav.stop()},4000)}}
});
setInterval(()=>{if(Nav.alvo)Nav.draw()},5000);
$('nv-x').onclick=()=>{if(Nav.alvo&&Nav.alvo.mob&&!confirm('Encerrar o modo Homem ao mar?'))return;Nav.stop()};
$('nv-map').onclick=()=>{show('carta');const a=Nav.alvo;if(a)setTimeout(()=>Carta.goTo(a.lat,a.lon),60)};
if(Nav.alvo){awake(true);Nav.draw()}
window.PW_GOTO=a=>Nav.start(a);

/* =====================================================================
   HOMEM AO MAR
   ===================================================================== */
const Mob={
  async press(){
    const f=Geo.fix&&now()-Geo.fix.t<30e3?Geo.fix:null;
    vib([500,200,500]);beep(2,1100,.3);
    if(f)return Mob.set(f);
    Geo.wait=true;Geo.tick();alerta('Marcando a posição… mantenha o celular a céu aberto.',false,8);
    const b=Geo.best();if(b&&!b.old)return Mob.set(b);
    const once=g=>{Geo.subs.splice(Geo.subs.indexOf(once),1);Mob.set(g)};Geo.subs.push(once);
    setTimeout(()=>{if(Geo.subs.includes(once)){Geo.subs.splice(Geo.subs.indexOf(once),1);const lf=Geo.best();if(lf)Mob.set(lf,true);else alerta('Sem GPS. Libere a localização nos ajustes do celular.',false,10)}},15000)},
  set(f,velho){Nav.start({n:'posição da queda',lat:f.lat,lon:f.lon,mob:true});Nav.alvo.t0=now();store.set('pw-nav',Nav.alvo);
    show('carta');setTimeout(()=>Carta.goTo(f.lat,f.lon,16),80);Mob.sheet(f,velho)},
  sheet(f,velho){const a=Nav.alvo||f,link='https://maps.google.com/?q='+a.lat.toFixed(5)+','+a.lon.toFixed(5);
    const txt=`🆘 HOMEM AO MAR · Paraty\nPosição da queda: ${dm(a.lat,'N','S')} ${dm(a.lon,'L','O')}\n${link}\nHora: ${clock(a.t0||now())}`;
    sheet(`<div class="hd"><div><div class="eyebrow" style="color:var(--stop)">Homem ao mar</div><h2 id="pl-name">Posição marcada</h2></div><button type="button" class="ghost x" data-x aria-label="Fechar">×</button></div>
      <p style="margin:0">A barra vermelha embaixo mostra a distância e o rumo de volta até a posição da queda.${velho?' <b>Atenção: usei a última posição conhecida.</b>':''}</p>
      <div class="cell"><span>Posição da queda</span><b>${dm(a.lat,'N','S')}  ${dm(a.lon,'L','O')}</b></div>
      <a class="btn mobbig" href="tel:185">📞 Ligar 185 · Marinha (salvamento)</a>
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">Enviar a posição no WhatsApp</a>
      <button type="button" class="ghost" data-x>Voltar para a carta</button>`)},
  hide(){}
};
$('t-mob').onclick=()=>Mob.press();

/* =====================================================================
   ALARME DE ÂNCORA
   ===================================================================== */
const Anc={...{on:false,lat:0,lon:0,raio:50,max:0,fora:0,silencio:0},...store.get('pw-anc',{})};
const ancSave=()=>store.set('pw-anc',{on:Anc.on,lat:Anc.lat,lon:Anc.lon,raio:Anc.raio,max:Anc.max});
let alarmeTimer=0;
function alarme(on,d){const el=$('pw-alarm');
  if(!on){el.hidden=true;clearInterval(alarmeTimer);alarmeTimer=0;return}
  $('am-d').textContent=Math.round(d)+' m';$('am-s').textContent=`O barco está a ${Math.round(d)} m da âncora (limite ${Anc.raio} m).`;
  if(el.hidden){el.hidden=false;const toca=()=>{beep(4,1200,.2);vib([600,200,600])};toca();clearInterval(alarmeTimer);alarmeTimer=setInterval(toca,2500)}}
$('am-snooze').onclick=()=>{Anc.silencio=now()+120e3;alarme(false)};
$('am-off').onclick=()=>{Anc.on=false;ancSave();alarme(false);awake(false);if(mode==='ancora')painel();redraw()};
Geo.subs.push(f=>{if(!Anc.on)return;const d=hav(f,Anc)*NM;if(d>Anc.max&&f.acc<60){Anc.max=d;ancSave()}
  if(mode==='ancora')painelAnc();
  if(d-Math.min(f.acc,40)*0.5>Anc.raio){Anc.fora++;if(Anc.fora>=2&&now()>Anc.silencio)alarme(true,d)}else{Anc.fora=0;if(!$('pw-alarm').hidden)alarme(false)}});
if(Anc.on)awake(true);

/* =====================================================================
   MEDIR, ROTA E PAINEL DAS FERRAMENTAS
   ===================================================================== */
let mode=null;const med=[];
const Rota={pts:store.get('pw-rota-edit',[]),salvas:store.get('pw-rotas',[]),vel:store.get('pw-vel',15),lh:store.get('pw-lh',''),
  save(){store.set('pw-rota-edit',Rota.pts)},
  total(){let s=0;for(let k=1;k<Rota.pts.length;k++)s+=hav(Rota.pts[k-1],Rota.pts[k]);return s}};
const HINT={marcar:'Toque na carta onde fica o ponto',ir:'Toque na carta para onde quer ir',rota:'Toque na carta para pôr cada ponto da rota',medir:'Toque na carta para medir (vários toques somam)'};
function setMode(m){mode=mode===m?null:m;if(mode!=='medir')med.length=0;
  document.querySelectorAll('.tools [data-t]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===mode));
  const h=$('maphint');h.hidden=!HINT[mode];h.textContent=HINT[mode]||'';painel();redraw();if(mode)track('clique','ferramenta-'+mode)}
document.querySelectorAll('.tools [data-t]').forEach(b=>b.onclick=()=>setMode(b.dataset.t));

function placeOpts(){return '<option value="">+ Pôr uma ilha ou praia</option>'+PLACES.map(p=>`<option value="${p.id}">${esc(p.n)}</option>`).join('')}
function painel(){
  if(!mode){tp.hidden=true;tp.innerHTML='';return}
  tp.hidden=false;
  const hd=(t)=>`<div class="hd"><h2>${t}</h2><button type="button" class="ghost" id="tp-x">Fechar</button></div>`;
  if(mode==='marcar'){const f=Geo.best();
    tp.innerHTML=hd('📍 Marcar ponto')+`<p class="legend" style="margin:0">Toque na carta no lugar exato, ou marque onde o barco está agora. Marque lajes, pedras, rasos, bons fundeios, combustível. Os perigos aprovados geram alerta para todos quando o barco chega perto (${ALERTA_M} m).</p>
      <button type="button" id="tp-aqui" ${f?'':'disabled'}>Marcar onde estou agora</button>
      <p class="legend" style="margin:0">${Pts.local.length?Pts.local.length+' ponto(s) só neste celular · ':''}${Pts.com.filter(p=>!p.pend).length} ponto(s) dos barqueiros${Pts.com.some(p=>p.pend&&p.meu)?' · '+Pts.com.filter(p=>p.pend&&p.meu).length+' seu(s) aguardando aprovação':''}</p>`;
    $('tp-aqui').onclick=()=>{const g=Geo.best();if(g)novoPonto(g.lat,g.lon)}}
  else if(mode==='ir'){tp.innerHTML=hd('🧭 Ir até')+`<p class="legend" style="margin:0">Toque na carta, num ponto marcado, ou escolha uma ilha ou praia. A barra embaixo mostra distância, rumo e hora de chegada pela sua velocidade.</p>
      <select id="tp-place">${placeOpts()}</select>`;
    $('tp-place').onchange=e=>{const p=PLACES.find(x=>x.id===e.target.value);if(p){Nav.start({n:p.n,lat:p.lat,lon:p.lon});setMode(null)}}}
  else if(mode==='medir'){let s=0;for(let k=1;k<med.length;k++)s+=hav(med[k-1],med[k]);
    tp.innerHTML=hd('📏 Medir')+`<div class="grid2"><div class="cell"><span>Distância</span><b>${med.length>1?dtxt(s):'—'}</b></div><div class="cell"><span>Rumo do último trecho</span><b>${med.length>1?rumo(bearing(med[med.length-2],med[med.length-1])):'—'}</b></div></div>
      <div class="row"><button type="button" class="ghost sm" id="tp-undo" ${med.length?'':'disabled'}>Desfazer</button><button type="button" class="ghost sm" id="tp-clr" ${med.length?'':'disabled'}>Limpar</button></div>`;
    $('tp-undo').onclick=()=>{med.pop();painel();redraw()};$('tp-clr').onclick=()=>{med.length=0;painel();redraw()}}
  else if(mode==='rota')painelRota();
  else if(mode==='ancora')painelAnc();
  $('tp-x').onclick=()=>setMode(null);
}
function painelRota(){
  const P=Rota.pts,tot=Rota.total(),h=Rota.vel>0?tot/Rota.vel*60:null,lit=h!=null&&+Rota.lh>0?h/60*Rota.lh:null;
  const legs=P.map((p,k)=>`<div><span class="n">${k+1}</span><span>${esc(p.n||'Ponto '+(k+1))}</span><b>${k?dtxt(hav(P[k-1],p))+' · '+rumo(bearing(P[k-1],p)).split(' ')[0]:'saída'}</b></div>`).join('');
  tp.innerHTML=`<div class="hd"><h2>🛣️ Rota planejada</h2><button type="button" class="ghost" id="tp-x">Fechar</button></div>
    <p class="legend" style="margin:0">Toque na carta para pôr cada ponto, ou escolha ilhas e praias. O app soma distância, tempo e combustível. Confira a rota na carta: ela é uma linha reta entre os pontos e não desvia de pedras sozinha.</p>
    <select id="tp-place">${placeOpts()}</select>
    ${P.length?`<div class="legs">${legs}</div>`:''}
    <div class="grid2"><label class="f">Velocidade de cruzeiro (nós)<input type="number" id="tp-vel" inputmode="decimal" min="1" max="60" value="${Rota.vel}"></label>
      <label class="f">Consumo do motor (litros/hora)<input type="number" id="tp-lh" inputmode="decimal" min="0" max="500" value="${Rota.lh}" placeholder="Ex.: 20"></label></div>
    <div class="grid2"><div class="cell"><span>Distância total</span><b>${P.length>1?dtxt(tot):'—'}</b></div><div class="cell"><span>Tempo</span><b>${P.length>1?hm(h):'—'}</b></div>
      <div class="cell"><span>Combustível</span><b>${P.length>1&&lit!=null?fmt(lit,lit<10?1:0)+' L':'—'}</b></div><div class="cell"><span>Ida e volta</span><b>${P.length>1&&lit!=null?fmt(lit*2,0)+' L':P.length>1?dtxt(tot*2):'—'}</b></div></div>
    <div class="row"><button type="button" id="tp-nav" ${P.length?'':'disabled'}>🧭 Navegar esta rota</button></div>
    <div class="row"><button type="button" class="ghost sm" id="tp-undo" ${P.length?'':'disabled'}>Desfazer</button><button type="button" class="ghost sm" id="tp-clr" ${P.length?'':'disabled'}>Limpar</button>
      <button type="button" class="ghost sm" id="tp-save" ${P.length>1?'':'disabled'}>Salvar</button><button type="button" class="ghost sm" id="tp-gpx" ${P.length>1?'':'disabled'}>GPX</button></div>
    ${Rota.salvas.length?`<div style="display:grid;gap:6px"><div class="eyebrow">Rotas salvas</div>${Rota.salvas.map((r,k)=>`<div class="legs"><div><span class="n">${r.pts.length}</span><span>${esc(r.nome)}</span><span><button type="button" class="ghost sm" data-ab="${k}">Abrir</button> <button type="button" class="ghost sm" data-ap="${k}" aria-label="Apagar ${esc(r.nome)}">×</button></span></div></div>`).join('')}</div>`:''}`;
  $('tp-place').onchange=e=>{const p=PLACES.find(x=>x.id===e.target.value);if(p){P.push({lat:p.lat,lon:p.lon,n:p.n});Rota.save();painel();redraw()}};
  $('tp-vel').onchange=e=>{Rota.vel=Math.max(0,+e.target.value||0);store.set('pw-vel',Rota.vel);painel()};
  $('tp-lh').onchange=e=>{Rota.lh=e.target.value===''?'':Math.max(0,+e.target.value||0);store.set('pw-lh',Rota.lh);painel()};
  $('tp-undo').onclick=()=>{P.pop();Rota.save();painel();redraw()};
  $('tp-clr').onclick=()=>{P.length=0;Rota.save();painel();redraw()};
  $('tp-nav').onclick=()=>{const pts=P.map((p,k)=>({...p,n:p.n||'Ponto '+(k+1)}));
    const f=Geo.best();let i=0;if(f&&pts.length>1&&hav(f,pts[0])*NM<150)i=1;   // já está no primeiro ponto
    Nav.start(pts[i],{pts,i});setMode(null)};
  $('tp-save').onclick=()=>{const nome=prompt('Nome da rota:',P.map(p=>p.n).filter(Boolean).slice(-1)[0]||'Minha rota');if(!nome)return;
    Rota.salvas.unshift({nome:nome.slice(0,50),pts:P.map(p=>({...p}))});Rota.salvas=Rota.salvas.slice(0,30);store.set('pw-rotas',Rota.salvas);painel()};
  $('tp-gpx').onclick=()=>gpx('rota',P.map((p,k)=>({...p,n:p.n||'Ponto '+(k+1)})),'Rota Paraty Waters');
  tp.querySelectorAll('[data-ab]').forEach(b=>b.onclick=()=>{const r=Rota.salvas[+b.dataset.ab];Rota.pts=r.pts.map(p=>({...p}));Rota.save();painel();redraw();
    const f=r.pts[0];if(f)Carta.goTo(f.lat,f.lon)});
  tp.querySelectorAll('[data-ap]').forEach(b=>b.onclick=()=>{if(!confirm('Apagar esta rota?'))return;Rota.salvas.splice(+b.dataset.ap,1);store.set('pw-rotas',Rota.salvas);painel()});
}
function painelAnc(){
  if(mode!=='ancora')return;const f=Geo.best();
  if(!Anc.on){
    tp.innerHTML=`<div class="hd"><h2>⚓ Alarme de âncora</h2><button type="button" class="ghost" id="tp-x">Fechar</button></div>
      <p class="legend" style="margin:0">Solte a âncora e ative aqui, com o barco em cima dela. Se o barco sair do círculo, o celular apita e vibra.</p>
      <div class="eyebrow">Raio de giro</div><div class="chips">${[30,50,80,120].map(r=>`<button type="button" data-r="${r}" aria-pressed="${Anc.raio===r}">${r} m</button>`).join('')}</div>
      <button type="button" id="tp-anc" ${f&&!f.old?'':'disabled'}>Ativar alarme aqui</button>
      <p class="legend" style="margin:0">${f&&!f.old?'GPS: precisão de '+Math.round(f.acc)+' m.':'Procurando GPS…'} O alarme só funciona com o app aberto e a tela ligada (o app deixa a tela acesa). Deixe o celular carregando.</p>`;
    tp.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{Anc.raio=+b.dataset.r;painelAnc()});
    $('tp-anc').onclick=()=>{const g=Geo.best();if(!g)return;Object.assign(Anc,{on:true,lat:g.lat,lon:g.lon,max:0,fora:0,silencio:0});ancSave();awake(true);unlockAudio();track('clique','ancora');painelAnc();redraw()};
  }else{const d=f?hav(f,Anc)*NM:null;
    tp.innerHTML=`<div class="hd"><h2>⚓ Âncora vigiando</h2><button type="button" class="ghost" id="tp-x">Fechar</button></div>
      <div class="grid2"><div class="cell"><span>Distância da âncora</span><b>${d!=null?Math.round(d)+' m':'—'}</b></div><div class="cell"><span>Limite</span><b>${Anc.raio} m</b></div>
        <div class="cell"><span>Maior distância</span><b>${Math.round(Anc.max)} m</b></div><div class="cell"><span>Precisão GPS</span><b>${f?'± '+Math.round(f.acc)+' m':'—'}</b></div></div>
      <div class="chips">${[30,50,80,120].map(r=>`<button type="button" data-r="${r}" aria-pressed="${Anc.raio===r}">${r} m</button>`).join('')}</div>
      <button type="button" class="ghost" id="tp-anc">Desligar alarme</button>
      <p class="legend" style="margin:0">Mantenha o app aberto e a tela ligada.</p>`;
    tp.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{Anc.raio=+b.dataset.r;ancSave();painelAnc();redraw()});
    $('tp-anc').onclick=()=>{Anc.on=false;ancSave();alarme(false);if(!Nav.alvo)awake(false);painelAnc();redraw()};
  }
  $('tp-x').onclick=()=>setMode(null);
}
setInterval(()=>{if(mode==='ancora'||mode==='marcar'){const a=document.activeElement;if(!a||!tp.contains(a))painel()}},4000);

/* toque na carta */
window.PW_MAPTAP=(lat,lon,el)=>{
  const m=el&&el.closest&&el.closest('.mk2');
  const pm=el&&el.closest&&el.closest('.mk'),place=pm&&PLACES.find(x=>x.id===pm.dataset.p);
  if(place&&mode&&mode!=='marcar'){
    if(mode==='ir'){Nav.start({n:place.n,lat:place.lat,lon:place.lon});setMode(null);return true}
    if(mode==='rota'){Rota.pts.push({lat:place.lat,lon:place.lon,n:place.n});Rota.save();painel();redraw();return true}
    if(mode==='medir'){med.push({lat:place.lat,lon:place.lon});painel();redraw();return true}}
  if(m&&!mode){if(m.dataset.id==='__mob'){Mob.sheet(Nav.alvo||{});return true}const p=Pts.all().find(x=>String(x.id)===m.dataset.id);if(p){ptSheet(p);return true}}
  if(!mode)return false;
  if(mode==='marcar'){novoPonto(lat,lon);return true}
  if(mode==='ir'){if(m){const p=Pts.all().find(x=>String(x.id)===m.dataset.id);if(p){Nav.start({n:p.nome,lat:p.lat,lon:p.lon});setMode(null);return true}}
    Nav.start({n:'ponto na carta',lat,lon});setMode(null);return true}
  if(mode==='medir'){med.push({lat,lon});painel();redraw();return true}
  if(mode==='rota'){let n='';if(m){const p=Pts.all().find(x=>String(x.id)===m.dataset.id);if(p){lat=p.lat;lon=p.lon;n=p.nome}}
    Rota.pts.push({lat,lon,n});Rota.save();painel();redraw();return true}
  return false;
};

/* =====================================================================
   DIÁRIO DE VIAGENS (trajeto gravado) E GPX
   ===================================================================== */
const Trip={cur:store.get('pw-trip-cur',null),lista:store.get('pw-trips',[]),ver:null};
window.addEventListener('pw-trip',e=>{const d=e.detail||{};
  if(d.on){Trip.cur={t0:now(),pts:[]};store.set('pw-trip-cur',Trip.cur);Geo.tick()}
  else if(Trip.cur){const c=Trip.cur;Trip.cur=null;store.set('pw-trip-cur',null);
    if(c.pts.length>=2&&(d.dist||0)>=0.02){let pts=c.pts;while(pts.length>2500)pts=pts.filter((_,k)=>k%2===0||k===pts.length-1);
      Trip.lista.unshift({id:'v'+c.t0,t0:c.t0,t1:now(),dist:d.dist||0,vmax:d.vmax||0,pts});
      while(Trip.lista.length>40)Trip.lista.pop();
      try{store.set('pw-trips',Trip.lista);localStorage.getItem('pw-trips')||0}catch(err){}
      renderTrips()}}
  redraw()});
Geo.subs.push(f=>{const c=Trip.cur;if(!c||!(typeof PW_TRIP==='function'&&PW_TRIP())||f.acc>50)return;
  const l=c.pts[c.pts.length-1];
  if(!l||hav({lat:l[0],lon:l[1]},f)*NM>12||f.t-l[2]>60e3){c.pts.push([+f.lat.toFixed(6),+f.lon.toFixed(6),f.t,+(f.spd||0).toFixed(1)]);if(c.pts.length%10===0)store.set('pw-trip-cur',c)}});
// viagem interrompida (app fechado no meio): salva o que foi gravado
if(Trip.cur&&!(typeof PW_TRIP==='function'&&PW_TRIP())){const c=Trip.cur;Trip.cur=null;store.set('pw-trip-cur',null);
  if(c.pts.length>=2){let dist=0,vmax=0;for(let k=1;k<c.pts.length;k++){dist+=hav({lat:c.pts[k-1][0],lon:c.pts[k-1][1]},{lat:c.pts[k][0],lon:c.pts[k][1]});vmax=Math.max(vmax,c.pts[k][3]||0)}
    Trip.lista.unshift({id:'v'+c.t0,t0:c.t0,t1:c.pts[c.pts.length-1][2],dist,vmax,pts:c.pts});store.set('pw-trips',Trip.lista)}}

function gpx(tipo,pts,nome){
  const x=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[c]);
  let body;
  if(tipo==='trk')body=`<trk><name>${x(nome)}</name><trkseg>${pts.map(p=>`<trkpt lat="${p[0]}" lon="${p[1]}"><time>${new Date(p[2]).toISOString()}</time></trkpt>`).join('')}</trkseg></trk>`;
  else body=`<rte><name>${x(nome)}</name>${pts.map(p=>`<rtept lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><name>${x(p.n)}</name></rtept>`).join('')}</rte>`;
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Paraty Waters" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;
  const fname=nome.replace(/[^\w\-]+/g,'-').toLowerCase()+'.gpx';
  const file=new File([xml],fname,{type:'application/gpx+xml'});
  track('clique','gpx-'+tipo);
  if(navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:nome}).catch(()=>{});return}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=fname;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
}
const navSec=document.querySelector('#v-navegar > div');
navSec.insertAdjacentHTML('beforeend',`<div class="panel"><h2>Diário de viagens</h2><div class="trips" id="trips"></div>
  <p class="legend" style="margin:0">Cada viagem iniciada acima fica gravada aqui com o caminho feito. Fica guardado só neste celular. GPX abre no GPS do barco, no Google Earth e em outros apps.</p></div>
  <div class="panel"><h2>Emergência</h2><button type="button" class="mobbig" id="nv-mob">🆘 Homem ao mar</button>
  <p class="legend" style="margin:0">Marca na hora a posição da queda e mostra o rumo e a distância para voltar. Também liga para a Marinha (185).</p></div>`);
$('nv-mob').onclick=()=>Mob.press();
function renderTrips(){const el=$('trips');if(!el)return;
  if(!Trip.lista.length){el.innerHTML='<p class="legend" style="margin:0">Nenhuma viagem gravada ainda.</p>';return}
  const dia=t=>new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'numeric',month:'short',timeZone:TZ}).format(new Date(t));
  el.innerHTML=Trip.lista.slice(0,15).map((v,k)=>{const min=(v.t1-v.t0)/60000;
    return `<div class="trip"><div class="tt"><span>${cap(dia(v.t0))}</span><small>${clock(v.t0)} às ${clock(v.t1)}</small></div>
      <div class="nums"><span>${dtxt(v.dist)}</span><span>${hm(min)}</span><span>máx ${fmt(v.vmax)} kn</span><span>méd ${fmt(min>1?v.dist/(min/60):0)} kn</span></div>
      <div class="row"><button type="button" class="ghost" data-tv="${k}">Ver na carta</button><button type="button" class="ghost" data-tg="${k}">GPX</button><button type="button" class="ghost" data-td="${k}" aria-label="Apagar viagem">Apagar</button></div></div>`}).join('')
    +(Trip.lista.length>15?`<p class="legend" style="margin:0">Mostrando as 15 mais recentes de ${Trip.lista.length}.</p>`:'');
  el.querySelectorAll('[data-tv]').forEach(b=>b.onclick=()=>{const v=Trip.lista[+b.dataset.tv];Trip.ver=v;show('carta');
    let a=90,c=-90,o=180,w=-180;v.pts.forEach(p=>{a=Math.min(a,p[0]);c=Math.max(c,p[0]);o=Math.min(o,p[1]);w=Math.max(w,p[1])});
    setTimeout(()=>Carta.fit(a,o,c,w),60);alerta('Mostrando a viagem na carta. Toque em OK para esconder.',true,5)});
  el.querySelectorAll('[data-tg]').forEach(b=>b.onclick=()=>{const v=Trip.lista[+b.dataset.tg];gpx('trk',v.pts,'Viagem '+new Date(v.t0).toISOString().slice(0,16).replace('T',' ').replace(':','h'))});
  el.querySelectorAll('[data-td]').forEach(b=>b.onclick=()=>{if(!confirm('Apagar esta viagem do diário?'))return;const v=Trip.lista.splice(+b.dataset.td,1)[0];if(Trip.ver===v)Trip.ver=null;store.set('pw-trips',Trip.lista);renderTrips();redraw()});
}
renderTrips();
// texto da aba Navegar sobre profundidade
const nb=[...document.querySelectorAll('#v-navegar .note-box')].find(n=>/profundidade/i.test(n.textContent));
if(nb)nb.innerHTML='O celular não mede profundidade: isso depende da ecossonda do barco e da carta náutica. Com a viagem ativa, o app <b>avisa ao chegar perto de lajes, pedras e rasos</b> marcados pelos barqueiros. Para marcar um, vá na aba Carta › 📍 Marcar.';

/* =====================================================================
   LOCALIZAÇÃO AO VIVO
   ===================================================================== */
const BASE=location.origin+location.pathname.replace(/[^/]*$/,'');
const Live={...{on:false,k:null,exp:0,sent:0,last:null},...store.get('pw-live',{})};
Live.on=!!(Live.k&&Live.exp>now());
const liveUrl=()=>Live.on?BASE+'ao-vivo.html?k='+Live.k:null;
window.PW_LIVE_URL=liveUrl;
const sharePanel=$('share-wa').closest('.panel');
sharePanel.insertAdjacentHTML('afterend',`<div class="panel" id="live"></div>`);
function renderLive(){const el=$('live');
  if(!Live.on){el.innerHTML=`<h2>Localização ao vivo</h2>
    <p class="legend" style="margin:0">Gera um link para a família ou a marina acompanhar o barco no mapa, atualizando sozinho. O link para de funcionar no fim do prazo.</p>
    <div class="eyebrow">Compartilhar por</div><div class="chips">${[2,4,8,12].map(h=>`<button type="button" data-h="${h}" aria-pressed="${(Live.h||4)===h}">${h} horas</button>`).join('')}</div>
    <button type="button" id="lv-go">Começar a compartilhar</button><span class="legend" id="lv-msg"></span>`;
    el.querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{Live.h=+b.dataset.h;renderLive()});
    $('lv-go').onclick=liveStart;return}
  const u=liveUrl(),txt=`Acompanhe o barco${fv&&fv.barco?' '+fv.barco:''} ao vivo no mapa: ${u}`;
  el.innerHTML=`<h2>📡 Localização ao vivo · ligada</h2>
    <div class="live-link">${esc(u)}</div>
    <div class="row"><a class="btn" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">Enviar no WhatsApp</a><button type="button" class="ghost" id="lv-copy">Copiar link</button></div>
    <p class="legend" style="margin:0" id="lv-msg">Até ${clock(Live.exp)}. ${Live.sent?'Última posição enviada às '+clock(Live.sent)+'.':'Esperando o GPS…'} Atualiza enquanto o app estiver aberto; com a viagem iniciada a tela fica acesa.</p>
    <button type="button" class="ghost" id="lv-stop">Parar de compartilhar</button>`;
  $('lv-copy').onclick=async()=>{try{await navigator.clipboard.writeText(u);$('lv-msg').textContent='Link copiado.'}catch(e){prompt('Copie o link:',u)}};
  $('lv-stop').onclick=liveStop;
}
const fv=store.get('np-form',{});
async function liveStart(){const sb=window.LM_SB;if(!sb){$('lv-msg').textContent='Entre na sua conta para usar.';return}
  $('lv-go').disabled=true;$('lv-msg').textContent='Criando o link…';
  try{const f2=store.get('np-form',{});const {data,error}=await sb.rpc('ao_vivo_iniciar',{horas:Live.h||4,barco:f2.barco||''});if(error)throw error;
    Object.assign(Live,{on:true,k:data,exp:now()+(Live.h||4)*36e5,sent:0,last:null});store.set('pw-live',Live);Geo.wait=true;Geo.tick();renderLive();track('clique','ao-vivo');
    try{buildShare()}catch(e){}
    const g=Geo.best();if(g&&!g.old)liveSend(g,true)}
  catch(e){const m=(e&&e.message)||'';$('lv-msg').textContent=/fetch|network|Load failed/i.test(m)?'Sem internet agora. Tente com sinal.':/function|does not exist|schema/i.test(m)?'Recurso ainda não ativado no servidor.':'Não consegui criar o link agora.';$('lv-go').disabled=false}}
async function liveStop(){const k=Live.k;Object.assign(Live,{on:false,k:null,exp:0});store.set('pw-live',Live);renderLive();try{buildShare()}catch(e){}
  try{await LM_SB.rpc('ao_vivo_parar',{k})}catch(e){}}
let liveBusy=false;
async function liveSend(f,force){if(!Live.on||liveBusy||!window.LM_SB)return;
  if(Live.exp<=now()){liveStop();return}
  const moved=!Live.last||hav(Live.last,f)*NM>25;if(!force&&!(moved&&now()-Live.sent>15e3)&&now()-Live.sent<120e3)return;
  liveBusy=true;try{const {data,error}=await LM_SB.rpc('ao_vivo_enviar',{k:Live.k,la:f.lat,lo:f.lon,v:+(f.spd||0).toFixed(1),h:f.hdg==null?null:Math.round(f.hdg),a:Math.round(f.acc)});
    if(!error){if(data===false){liveStop();return}Live.sent=now();Live.last={lat:f.lat,lon:f.lon};store.set('pw-live',Live);if($('lv-msg')&&!$('lv-msg').matches(':focus'))renderLive()}}catch(e){}liveBusy=false}
Geo.subs.push(f=>{if(Live.on&&f.acc<200)liveSend(f)});
setInterval(()=>{if(Live.on&&Live.exp<=now())liveStop()},60e3);
renderLive();

/* =====================================================================
   MODO NOTURNO E VENTO NA CARTA
   ===================================================================== */
let noite=store.get('pw-night',false),vento=store.get('pw-vento',false);
function aplicaNoite(){document.documentElement.classList.toggle('night',noite);$('m-night').classList.toggle('on',noite);
  const m=document.querySelector('meta[name="theme-color"]');if(m){if(!m.dataset.orig)m.dataset.orig=m.content;m.content=noite?'#000000':m.dataset.orig}}
$('m-night').onclick=()=>{noite=!noite;store.set('pw-night',noite);aplicaNoite();track('clique','modo-noturno')};
$('m-vento').onclick=()=>{vento=!vento;store.set('pw-vento',vento);$('m-vento').classList.toggle('on',vento);redraw();if(vento&&!LAST)alerta('Atualize a previsão para ver o vento na carta.',false,5)};
aplicaNoite();$('m-vento').classList.toggle('on',vento);

/* =====================================================================
   DESENHO SOBRE A CARTA (chamado a cada quadro da Carta)
   ===================================================================== */
const ov=$('ov');
window.PW_OV=v=>{
  const xy=(la,lo)=>v.xy(la,lo),P=(a)=>{const q=xy(a.lat,a.lon);return q.x.toFixed(1)+','+q.y.toFixed(1)};
  const mpp=v.r*Math.cos(Math.atan(Math.sinh(v.cy/6378137)));
  let s='';
  // viagem mostrada do diário
  if(Trip.ver&&Trip.ver.pts.length>1)s+=`<polyline points="${Trip.ver.pts.map(p=>P({lat:p[0],lon:p[1]})).join(' ')}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${Trip.ver.pts.map(p=>P({lat:p[0],lon:p[1]})).join(' ')}" fill="none" stroke="#4fd1e8" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  // viagem atual
  if(Trip.cur&&Trip.cur.pts.length>1)s+=`<polyline points="${Trip.cur.pts.map(p=>P({lat:p[0],lon:p[1]})).join(' ')}" fill="none" stroke="#e9b949" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" stroke-opacity=".95"/>`;
  // rota
  if(Rota.pts.length&&(mode==='rota'||(Nav.alvo&&Nav.alvo.rota))){const R=Nav.alvo&&Nav.alvo.rota&&mode!=='rota'?Nav.alvo.rota.pts:Rota.pts;
    if(R.length>1)s+=`<polyline points="${R.map(P).join(' ')}" fill="none" stroke="#0d2a33" stroke-width="6" stroke-linejoin="round"/><polyline points="${R.map(P).join(' ')}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="10 6" stroke-linejoin="round"/>`;
    R.forEach((p,k)=>{const q=xy(p.lat,p.lon);s+=`<circle cx="${q.x}" cy="${q.y}" r="10" fill="#0f5a6b" stroke="#fff" stroke-width="2"/><text x="${q.x}" y="${q.y+4}" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${k+1}</text>`})}
  // medir
  if(med.length){s+=`<polyline points="${med.map(P).join(' ')}" fill="none" stroke="#e9b949" stroke-width="3" stroke-dasharray="6 4"/>`;let acc=0;
    med.forEach((p,k)=>{const q=xy(p.lat,p.lon);if(k)acc+=hav(med[k-1],p);s+=`<circle cx="${q.x}" cy="${q.y}" r="5" fill="#e9b949" stroke="#0d2a33" stroke-width="2"/>`+(k?lbl(q.x,q.y-12,dtxt(acc)):'')})}
  // âncora
  if(Anc.on){const q=xy(Anc.lat,Anc.lon),rr=Anc.raio/mpp;s+=`<circle cx="${q.x}" cy="${q.y}" r="${rr.toFixed(1)}" fill="rgba(233,185,73,.15)" stroke="#e9b949" stroke-width="2.5" stroke-dasharray="7 5"/>`+lbl(q.x,q.y-4,'⚓',16)}
  // ir até
  if(Nav.alvo){const f=Geo.best(),q=xy(Nav.alvo.lat,Nav.alvo.lon),c=Nav.alvo.mob?'#ff5a4a':'#ff3df0';
    if(f){const o=xy(f.lat,f.lon);s+=`<line x1="${o.x}" y1="${o.y}" x2="${q.x}" y2="${q.y}" stroke="#000" stroke-opacity=".4" stroke-width="6"/><line x1="${o.x}" y1="${o.y}" x2="${q.x}" y2="${q.y}" stroke="${c}" stroke-width="3" stroke-dasharray="9 6"/>`}
    s+=`<circle cx="${q.x}" cy="${q.y}" r="13" fill="none" stroke="${c}" stroke-width="3"/><circle cx="${q.x}" cy="${q.y}" r="4" fill="${c}"/>`}
  // vento
  if(vento&&LAST&&v.zoom>=11.5)LAST.results.forEach(z=>{if(z.missing||z.dir==null)return;const q=xy(z.lat,z.lon);if(q.x<-30||q.y<-30||q.x>v.W+30||q.y>v.H+30)return;
    const col=z.gust>=RULE.gustStop?'#ef6b5c':z.gust>=RULE.gustWarn?'#e3a849':'#4cc37e';
    s+=`<g transform="translate(${q.x} ${q.y}) rotate(${z.dir+180})"><path d="M0 -20 L9 6 L0 1 L-9 6 Z" fill="${col}" stroke="#0d2a33" stroke-width="2" stroke-linejoin="round"/></g>`+lbl(q.x,q.y+24,fmt(z.wind,0)+'–'+fmt(z.gust,0)+' kn')});
  ov.innerHTML=s;
  // marcadores
  const small=v.zoom<13.3,hideAll=v.zoom<11.8;
  ovmk.querySelectorAll('.mk2').forEach(el=>{
    let p;if(el.dataset.id==='__mob'){if(!(Nav.alvo&&Nav.alvo.mob)){el.style.display='none';return}p=Nav.alvo}else p=Pts.all().find(x=>String(x.id)===el.dataset.id);
    if(!p){el.style.display='none';return}
    const q=xy(p.lat,p.lon);const show=!hideAll&&q.x>-30&&q.y>-30&&q.x<v.W+30&&q.y<v.H+30;
    el.style.display=show?'':'none';if(!show)return;el.style.left=q.x.toFixed(1)+'px';el.style.top=q.y.toFixed(1)+'px';el.classList.toggle('small',small&&el.dataset.id!=='__mob')});
};
function lbl(x,y,t,fs=11){return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff" stroke="#0d2a33" stroke-width="3" paint-order="stroke">${esc(t)}</text>`}
// botão para esconder a viagem mostrada
const hideTrip=()=>{if(Trip.ver){Trip.ver=null;redraw()}};
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{if(t.dataset.v!=='carta')hideTrip()}));
$('al-x').addEventListener('click',hideTrip);

/* ---------- folha (dialog) ---------- */
function sheet(html){const d=$('sheet');$('sheet-in').innerHTML=html;$('sheet-in').querySelectorAll('[data-x]').forEach(b=>b.onclick=closeSheet);if(d.showModal){if(!d.open)d.showModal()}else d.setAttribute('open','')}
function closeSheet(){const d=$('sheet');try{d.close()}catch(e){d.removeAttribute('open')}}

redraw();
})();
