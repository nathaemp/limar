/* Paraty Waters · guia de instalação no iPhone/iPad
   O iPhone não deixa um site instalar sozinho: só a pessoa, pelo menu do navegador.
   Este guia mostra uma seta animada apontando o botão certo para cada navegador e versão,
   e os passos com os mesmos ícones que aparecem na tela. */
(function(){
'use strict';
const ua=navigator.userAgent;
const ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
if(!ios)return;
const ipad=/iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
const inApp=/Instagram|FBAN|FBAV|FB_IAB|Line\/|musical_ly|BytedanceWebview|TikTok|Snapchat|LinkedInApp|Twitter/i.test(ua);
const chrome=/CriOS/.test(ua),other=/FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
const ver=+((ua.match(/Version\/(\d+)/)||[])[1]||0);
const novo=ver>=26;   // Safari do iOS 26: o Compartilhar fica dentro do botão ⋯
const appNome=/Instagram/i.test(ua)?'Instagram':/FBAN|FBAV|FB_IAB/i.test(ua)?'Facebook':/musical_ly|Bytedance|TikTok/i.test(ua)?'TikTok':/Line\//.test(ua)?'Line':'outro aplicativo';
const URL_APP=location.origin+location.pathname.replace(/index\.html$/,'');
const track=d=>{try{window.LM_TRACK&&LM_TRACK('clique','instalar-guia-'+d)}catch(e){}};

/* ícones iguais aos do iPhone */
const I={
  mais:'<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="12.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="14" r="1.9" fill="currentColor"/><circle cx="14" cy="14" r="1.9" fill="currentColor"/><circle cx="19.5" cy="14" r="1.9" fill="currentColor"/></svg>',
  share:'<svg viewBox="0 0 28 28"><path d="M9.5 11H7.5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 7.5 25h13a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 20.5 11h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 17V3M9.5 7.5 14 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  addhome:'<svg viewBox="0 0 28 28"><rect x="4" y="4" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 9v10M9 14h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  safari:'<svg viewBox="0 0 28 28"><circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18.5 9.5 15.5 15.5 9.5 18.5 12.5 12.5Z" fill="currentColor"/></svg>'
};

/* passos de cada caso: [ícone, texto] + onde fica o primeiro botão */
function plano(){
  if(inApp)return {tipo:'inapp',onde:'tr',titulo:'Abra no Safari para instalar',passos:[
      ['safari',`Você está dentro do <b>${appNome}</b>. Por aqui o iPhone não instala.`],
      ['mais','Toque no botão abaixo, ou no <b>⋯</b> lá em cima e escolha <b>Abrir no navegador</b>.'],
      ['addhome','No Safari, toque de novo em <b>Instalar o app</b>.']]};
  if(chrome)return {tipo:'chrome',onde:'tr',titulo:'Instalar em 3 toques',passos:[
      ['share','Toque em <b>Compartilhar</b>, no alto, à direita da barra de endereço.'],
      ['addhome','Role a lista e toque em <b>Adicionar à Tela de Início</b>.'],
      ['ok','Toque em <b>Adicionar</b>, no canto de cima.']]};
  if(other)return {tipo:'outro',onde:'br',titulo:'Instalar pelo menu',passos:[
      ['mais','Abra o <b>menu</b> do navegador e toque em <b>Compartilhar</b>.'],
      ['addhome','Toque em <b>Adicionar à Tela de Início</b>.'],
      ['ok','Toque em <b>Adicionar</b>. Se não aparecer, abra este endereço no Safari.']]};
  if(ipad)return {tipo:'ipad',onde:'tr',titulo:'Instalar em 3 toques',passos:[
      ['share','Toque em <b>Compartilhar</b>, no alto da tela, à direita.'+(novo?' (se não aparecer, toque em <b>⋯</b> primeiro)':'')],
      ['addhome','Toque em <b>Adicionar à Tela de Início</b>.'],
      ['ok','Toque em <b>Adicionar</b>.']]};
  if(novo)return {tipo:'safari26',onde:'br',titulo:'Instalar em 4 toques',passos:[
      ['mais','Toque no <b>⋯</b>, ao lado do endereço do site.'],
      ['share','Toque em <b>Compartilhar</b>.'],
      ['addhome','Role para baixo e toque em <b>Adicionar à Tela de Início</b>.'],
      ['ok','Toque em <b>Adicionar</b>, no canto de cima. Pronto!']]};
  return {tipo:'safari',onde:'bc',titulo:'Instalar em 3 toques',passos:[
      ['share','Toque em <b>Compartilhar</b>, na barra de baixo do Safari.'],
      ['addhome','Role a lista e toque em <b>Adicionar à Tela de Início</b>.'],
      ['ok','Toque em <b>Adicionar</b>, no canto de cima. Pronto!']]};
}

const css=document.createElement('style');css.textContent=`
#pw-ig{position:fixed;inset:0;z-index:9800;background:rgba(4,18,23,.62);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:ig-in .25s ease-out;font-family:var(--body,system-ui),system-ui,sans-serif}
#pw-ig .card{position:absolute;left:12px;right:12px;margin:0 auto;max-width:440px;background:#fff;color:#0d2a33;border-radius:20px;padding:18px 18px 14px;box-shadow:0 18px 50px rgba(0,0,0,.4);display:grid;gap:12px;animation:ig-card .4s cubic-bezier(.2,.8,.2,1)}
#pw-ig.top .card{top:calc(14px + env(safe-area-inset-top,0px))}
#pw-ig.bot .card{bottom:calc(120px + env(safe-area-inset-bottom,0px))}
#pw-ig .hd{display:grid;grid-template-columns:44px 1fr 36px;gap:12px;align-items:center}
#pw-ig .hd img{width:44px;height:44px;border-radius:11px}
#pw-ig .hd b{font:700 1.3rem/1.1 var(--display,system-ui),system-ui,sans-serif;display:block}
#pw-ig .hd small{color:#557079;font-size:.8rem}
#pw-ig .x{width:36px;height:36px;border-radius:50%;border:0;background:#eef2f1;color:#0d2a33;font-size:1.2rem;padding:0;line-height:1}
#pw-ig ol{list-style:none;margin:0;padding:0;display:grid;gap:6px;counter-reset:s}
#pw-ig li{display:grid;grid-template-columns:26px 40px 1fr;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;font-size:.95rem;line-height:1.3;transition:background .3s,transform .3s;counter-increment:s}
#pw-ig li::before{content:counter(s);width:24px;height:24px;border-radius:50%;background:#d6e8ea;color:#0f5a6b;font-weight:700;font-size:.8rem;display:grid;place-items:center}
#pw-ig li .ic{width:40px;height:40px;border-radius:10px;background:#f2f4f5;color:#007aff;display:grid;place-items:center}
#pw-ig li .ic svg{width:26px;height:26px}
#pw-ig li .ic.ok{color:#007aff;font-weight:700;font-size:.62rem;background:#f2f4f5;letter-spacing:-.01em}
#pw-ig li.on{background:#fff7e3;transform:scale(1.02)}
#pw-ig li.on::before{background:#e9b949;color:#1d1606}
#pw-ig .acts{display:flex;gap:8px;flex-wrap:wrap}
#pw-ig .acts>*{flex:1 1 140px;text-align:center;text-decoration:none;font:700 1rem/1.2 inherit;border-radius:12px;padding:12px;border:2px solid #0f5a6b}
#pw-ig .go{background:#0f5a6b;color:#fff}
#pw-ig .no{background:transparent;color:#0f5a6b}
#pw-ig .nt{margin:0;font-size:.8rem;color:#557079;text-align:center}
#pw-ig .arw{position:absolute;display:grid;justify-items:center;gap:4px;pointer-events:none;color:#e9b949;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45))}
#pw-ig .arw svg{width:64px;height:64px}
#pw-ig .arw span{background:#e9b949;color:#1d1606;font-weight:700;font-size:.85rem;padding:6px 12px;border-radius:999px;white-space:nowrap}
#pw-ig .arw.br{right:2px;bottom:calc(6px + env(safe-area-inset-bottom,0px))}
#pw-ig .arw.bc{left:50%;bottom:calc(6px + env(safe-area-inset-bottom,0px));transform:translateX(-50%)}
#pw-ig .arw.tr{right:6px;top:calc(4px + env(safe-area-inset-top,0px))}
#pw-ig .arw.br svg,#pw-ig .arw.bc svg{animation:ig-down 1s ease-in-out infinite}
#pw-ig .arw.tr svg{animation:ig-up 1s ease-in-out infinite}
#pw-ig .arw.br span{margin-right:12px}
@keyframes ig-in{from{opacity:0}}
@keyframes ig-card{from{opacity:0;transform:translateY(16px)}}
@keyframes ig-down{50%{transform:translateY(12px)}}
@keyframes ig-up{50%{transform:translateY(-12px)}}
@media (prefers-reduced-motion:reduce){#pw-ig .arw svg{animation:none}}
`;document.head.appendChild(css);

let timer=0;
function fechar(){const el=document.getElementById('pw-ig');if(el)el.remove();clearInterval(timer);document.removeEventListener('keydown',esc)}
function esc(e){if(e.key==='Escape')fechar()}
function abrir(){
  fechar();const P=plano();track(P.tipo);
  const baixo=P.onde!=='tr';
  const seta=baixo
    ?'<svg viewBox="0 0 64 64"><path d="M32 6v44M14 34l18 18 18-18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    :'<svg viewBox="0 0 64 64"><path d="M32 58V14M14 30l18-18 18 18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const lbl=P.tipo==='inapp'?'ou aqui: ⋯':P.tipo==='safari26'?'Comece aqui: ⋯':'Comece aqui';
  const el=document.createElement('div');el.id='pw-ig';el.className=baixo?'top':'bot';el.setAttribute('role','dialog');el.setAttribute('aria-label','Como instalar o Paraty Waters');
  el.innerHTML=`<div class="card">
    <div class="hd"><img src="icons/icon-192.png" alt=""><div><b>${P.titulo}</b><small>O ícone do Paraty Waters vai para a tela inicial</small></div><button type="button" class="x" aria-label="Fechar">×</button></div>
    <ol>${P.passos.map(([ic,t])=>`<li><span class="ic${ic==='ok'?' ok':''}">${ic==='ok'?'Adicionar':I[ic]}</span><span>${t}</span></li>`).join('')}</ol>
    <div class="acts">${P.tipo==='inapp'
      ?`<a class="go" href="x-safari-${URL_APP}">Abrir no Safari</a><button type="button" class="no" data-copy>Copiar link</button>`
      :`<button type="button" class="go" data-ok>Entendi</button>`}</div>
    <p class="nt">Não quer instalar agora? Tudo bem: o app funciona normal pelo navegador.</p>
  </div>
  <div class="arw ${P.onde}">${baixo?`<span>${lbl}</span>${seta}`:`${seta}<span>${lbl}</span>`}</div>`;
  document.body.appendChild(el);
  // destaca um passo de cada vez, mostrando a ordem
  const lis=[...el.querySelectorAll('li')];let k=0;const on=()=>{lis.forEach((l,i)=>l.classList.toggle('on',i===k));k=(k+1)%lis.length};on();timer=setInterval(on,1800);
  el.querySelector('.x').onclick=fechar;
  el.addEventListener('click',e=>{if(e.target===el)fechar()});
  const ok=el.querySelector('[data-ok]');if(ok)ok.onclick=fechar;
  const cp=el.querySelector('[data-copy]');if(cp)cp.onclick=async()=>{try{await navigator.clipboard.writeText(URL_APP);cp.textContent='Link copiado! Cole no Safari'}catch(e){prompt('Copie o link e abra no Safari:',URL_APP)}};
  document.addEventListener('keydown',esc);
}
window.PW_IOS_GUIDE=abrir;
})();
