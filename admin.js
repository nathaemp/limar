/* Limamar · administração
   Só abre para administradores (o banco confere em cada função).
   Painel com uso do app, quem está online, usuários e cortesias. */
(()=>{
"use strict";
const sb=window.LM_SB;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const TZ='America/Sao_Paulo';
const n0=v=>Number(v||0).toLocaleString('pt-BR');
const quando=d=>{if(!d)return '—';const t=new Date(d),m=(Date.now()-t)/60000;
  if(m<2)return 'agora';if(m<60)return 'há '+Math.round(m)+' min';if(m<1440)return 'há '+Math.round(m/60)+' h';
  return new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'short',year:m>525600?'numeric':undefined,timeZone:TZ}).format(t)};
const dataBR=d=>d?new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'';
const erroTxt=e=>{const m=(e&&(e.message||e.details))||String(e);return /Acesso restrito/.test(m)?'Só administradores podem ver isto.':/Failed to fetch|NetworkError|Load failed/.test(m)?'Sem internet agora.':m};

/* ---------- estilo ---------- */
const css=document.createElement('style');css.textContent=`
#admin{position:fixed;inset:0;z-index:45;background:var(--bg);overflow:auto;-webkit-overflow-scrolling:touch}
#admin .box{max-width:760px;margin:0 auto;padding:calc(14px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-left,0px)) calc(40px + env(safe-area-inset-bottom,0px));display:grid;gap:16px}
#admin .top{display:flex;justify-content:space-between;align-items:center;gap:10px}
#admin .top h1{font-family:var(--display);font-size:2rem;margin:0;line-height:1}
#admin .seg{grid-template-columns:repeat(3,1fr)}
#admin .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
#admin .kpi{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:grid;gap:2px}
#admin .kpi b{font-family:var(--display);font-size:2rem;line-height:1}
#admin .kpi span{font-size:.78rem;color:var(--muted)}
#admin .kpi.live b{color:var(--go)}
#admin .live-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--go);margin-right:6px;box-shadow:0 0 0 0 rgba(31,138,76,.6);animation:lmpulse 2s infinite}
@keyframes lmpulse{70%{box-shadow:0 0 0 8px rgba(31,138,76,0)}100%{box-shadow:0 0 0 0 rgba(31,138,76,0)}}
@media (prefers-reduced-motion:reduce){#admin .live-dot{animation:none}}
#admin table{width:100%;border-collapse:collapse;font-size:.92rem}
#admin th,#admin td{padding:9px 6px;border-top:1px solid var(--line);text-align:right;font-variant-numeric:tabular-nums}
#admin th{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);border-top:0}
#admin td:first-child,#admin th:first-child{text-align:left}
#admin td small{display:block;color:var(--muted);font-size:.74rem}
#admin .bars{display:grid;grid-template-columns:repeat(14,1fr);gap:4px;align-items:end;height:110px}
#admin .bars div{display:grid;grid-template-rows:1fr auto;gap:3px;height:100%;text-align:center;font-size:.62rem;color:var(--muted)}
#admin .bars i{display:block;align-self:end;background:var(--bay);border-radius:3px 3px 0 0;min-height:2px}
#admin .bars i.hoje{background:var(--sand)}
#admin .rank{display:grid;gap:6px}
#admin .rank div{display:grid;grid-template-columns:1fr auto;gap:8px;font-size:.9rem;position:relative;padding:5px 8px;border-radius:6px;overflow:hidden}
#admin .rank div::before{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);background:var(--bay-soft);z-index:0}
#admin .rank div>*{position:relative}
#admin .rank b{font-variant-numeric:tabular-nums}
#admin .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
#admin .user{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px;display:grid;gap:10px}
#admin .user .hd2{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:center}
#admin .user .av{width:44px;height:44px;border-radius:50%;background:var(--bay-soft);color:var(--bay);display:grid;place-items:center;font-weight:700;overflow:hidden}
#admin .user .av img{width:100%;height:100%;object-fit:cover}
#admin .user .nm{font-weight:700;overflow-wrap:anywhere}
#admin .user .em{font-size:.82rem;color:var(--muted);overflow-wrap:anywhere}
#admin .tags{display:flex;flex-wrap:wrap;gap:6px}
#admin .tag{font-size:.7rem;font-weight:700;padding:3px 8px;border-radius:999px;background:var(--bay-soft);color:var(--muted)}
#admin .tag.ok{background:var(--go-bg);color:var(--go)} #admin .tag.warn{background:var(--warn-bg);color:var(--warn)} #admin .tag.bad{background:var(--stop-bg);color:var(--stop)} #admin .tag.gold{background:#f6e7bf;color:#7a5a00}
#admin .acts{display:flex;flex-wrap:wrap;gap:8px}
#admin .acts button{padding:8px 12px;font-size:.84rem;flex:0 1 auto}
#admin .acts .danger{border-color:var(--stop);color:var(--stop);background:transparent}
#admin .acts .danger.sure{background:var(--stop);color:#fff}
#admin .filters{display:flex;flex-wrap:wrap;gap:6px}
#admin .filters button{padding:6px 12px;font-size:.82rem;border-radius:999px;border-width:1px;background:transparent;color:var(--ink);border-color:var(--line)}
#admin .filters button[aria-pressed="true"]{background:var(--bay);color:var(--on-bay);border-color:var(--bay)}
#admin input[type=search],#admin input[type=email],#admin input[type=date],#admin input[type=text]{font:inherit;font-size:1rem;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:11px;width:100%;min-width:0}
#admin .inline{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}
#admin .msg{font-size:.9rem;border-radius:10px;padding:10px 12px;margin:0}
#admin .msg.err{background:var(--stop-bg);color:var(--stop)} #admin .msg.ok{background:var(--go-bg);color:var(--go)}
#admin .empty{color:var(--muted);font-size:.9rem;margin:0}
#admin details.sec{background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
#admin details.sec>summary{list-style:none;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:13px 14px;cursor:pointer}
#admin details.sec>summary::-webkit-details-marker{display:none}
#admin details.sec>summary b{font-family:var(--display);font-size:1.15rem;display:block;line-height:1.15}
#admin details.sec>summary small{font-size:.8rem;color:var(--muted)}
#admin details.sec>summary .chev{color:var(--muted);font-size:.8rem;transition:transform .15s}
#admin details.sec[open]>summary .chev{transform:rotate(90deg)}
#admin details.sec>summary:focus-visible{outline:3px solid var(--sand);outline-offset:-3px}
#admin .sec-in{padding:0 14px 14px;display:grid;gap:12px}
#admin details.user{padding:0;gap:0}
#admin details.user>summary{list-style:none;display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:10px 12px;cursor:pointer}
#admin details.user>summary::-webkit-details-marker{display:none}
#admin details.user>summary .av{width:40px;height:40px}
#admin details.user>summary .mini{display:flex;gap:4px;align-items:center}
#admin details.user>summary .mini i{width:9px;height:9px;border-radius:50%;display:block}
#admin details.user[open]>summary .chev{transform:rotate(90deg)}
#admin details.user .chev{color:var(--muted);font-size:.8rem;transition:transform .15s}
#admin details.user .user-in{padding:0 12px 12px;display:grid;gap:10px}
`;document.head.appendChild(css);

/* ---------- estrutura ---------- */
const root=document.createElement('div');root.id='admin';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','Administração do Limamar');
root.innerHTML=`<div class="box">
  <div class="top"><div><div class="eyebrow">Limamar</div><h1>Administração</h1></div>
    <div style="display:flex;gap:8px"><button type="button" class="ghost" id="ad-ref" style="padding:8px 12px">Atualizar</button><button type="button" class="ghost x" id="ad-x" aria-label="Fechar" style="width:44px;height:44px;padding:0;border-radius:50%;font-size:1.4rem">×</button></div></div>
  <div class="seg" role="group" aria-label="Seções">
    <button type="button" data-s="painel" aria-pressed="true">Painel</button>
    <button type="button" data-s="usuarios" aria-pressed="false">Usuários</button>
    <button type="button" data-s="cortesias" aria-pressed="false">Cortesias</button>
  </div>
  <div id="ad-msg" aria-live="polite"></div>
  <div id="ad-body"><p class="empty">Carregando…</p></div>
</div>`;
document.body.appendChild(root);
let secao='painel',timer=null,USERS=[],filtro='todos',busca='';
let ABERTAS=new Set();try{ABERTAS=new Set(JSON.parse(localStorage.getItem('lm-adm-abertas')||'[]'))}catch(e){}
const guardaAbertas=()=>{try{localStorage.setItem('lm-adm-abertas',JSON.stringify([...ABERTAS]))}catch(e){}};
root.addEventListener('toggle',e=>{const d=e.target;if(!(d instanceof HTMLDetailsElement)||!d.dataset.sec)return;
  d.open?ABERTAS.add(d.dataset.sec):ABERTAS.delete(d.dataset.sec);guardaAbertas()},true);
const sec=(id,titulo,resumo,corpo,attrs='')=>`<details class="sec" data-sec="${id}"${ABERTAS.has(id)?' open':''}${attrs}><summary><span><b>${titulo}</b>${resumo?`<small>${resumo}</small>`:''}</span><span class="chev" aria-hidden="true">▶</span></summary><div class="sec-in">${corpo}</div></details>`;
const msg=(t,c)=>{$('ad-msg').innerHTML=t?`<p class="msg ${c||'err'}">${esc(t)}</p>`:'';if(t&&c==='ok')setTimeout(()=>{if($('ad-msg'))$('ad-msg').innerHTML=''},3000)};
root.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{secao=b.dataset.s;root.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-pressed',x===b));msg('');carrega()});
$('ad-x').onclick=fechar;$('ad-ref').onclick=()=>carrega();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden)fechar()});

function abrir(){root.hidden=false;document.documentElement.style.overflow='hidden';carrega();clearInterval(timer);timer=setInterval(()=>{const ed=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#ad-po,#ad-ntfy,#ad-wg');const digitado=['po-u','po-t'].some(i=>$(i)&&$(i).value)||!!document.querySelector('#ad-wg textarea');if(secao==='painel'&&document.visibilityState==='visible'&&!ed&&!digitado)carrega(true)},30000)}
function fechar(){root.hidden=true;document.documentElement.style.overflow='';clearInterval(timer)}

async function carrega(silencioso){
  if(!silencioso)$('ad-body').innerHTML='<p class="empty">Carregando…</p>';
  try{
    if(secao==='painel'){const {data,error}=await sb.rpc('admin_estatisticas');if(error)throw error;painel(data)}
    else if(secao==='usuarios'){const {data,error}=await sb.rpc('admin_usuarios');if(error)throw error;USERS=data||[];usuarios()}
    else{const {data,error}=await sb.rpc('admin_cortesias');if(error)throw error;cortesias(data||[])}
  }catch(e){if(!silencioso)$('ad-body').innerHTML='';msg(erroTxt(e))}
}

/* ---------- painel ---------- */
const LINHAS=[['visitantes','Visitantes','Aparelhos diferentes que abriram o app'],
  ['usuarios_ativos','Usuários ativos','Contas que usaram o app'],['cadastros','Cadastros','Contas criadas'],['confirmados','E-mails confirmados','Contas que confirmaram o e-mail'],
  ['cliques','Cliques em botões','Toques em botões do app'],['instalacoes','Instalações','Toques em Instalar e instalações concluídas']];
function rank(lista,vazio){if(!lista||!lista.length)return `<p class="empty">${vazio}</p>`;const max=Math.max(...lista.map(x=>x.n));
  return `<div class="rank">${lista.map(x=>`<div style="--w:${Math.max(4,x.n/max*100)}%"><span>${esc(x.item)}</span><b>${n0(x.n)}</b></div>`).join('')}</div>`}
function painel(d){
  const P=d.periodos||{},T=d.totais||{};
  const serie=d.serie||[],mx=Math.max(1,...serie.map(s=>s.visitantes));
  const diaCurto=s=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric'});
  const on=d.online_lista||[];
  $('ad-body').innerHTML=`<div style="display:grid;gap:10px">
    <div class="kpis">
      <div class="kpi live"><b>${n0(d.online)}</b><span><i class="live-dot"></i>Online agora</span></div>
      <div class="kpi"><b>${n0(T.usuarios)}</b><span>Contas no total</span></div>
      <div class="kpi"><b>${n0(T.cadastro_ok)}</b><span>Cadastros concluídos</span></div>
      <div class="kpi"><b>${n0(T.cortesias)}</b><span>Cortesias ativas</span></div>
      <div class="kpi"><b>${n0(T.bloqueados)}</b><span>Bloqueados</span></div>
    </div>
    ${sec('online','Quem está online',on.length?n0(on.length)+(on.length===1?' conta usando agora':' contas usando agora'):'Ninguém logado agora',
      (on.length?`<div class="rank">${on.map(u=>`<div style="--w:0%"><span><i class="live-dot"></i>${esc(u.nome)} <small style="color:var(--muted)">${esc(u.email)}</small></span><b>${quando(u.visto)}</b></div>`).join('')}</div>`:'<p class="empty">Nenhuma conta usando o app neste momento.</p>')
      +(d.online_anonimos?`<p class="legend" style="margin:0">+ ${n0(d.online_anonimos)} na tela de entrar (sem login).</p>`:'')
      +'<p class="legend" style="margin:0">Conta como online quem usou o app nos últimos 2 minutos.</p>')}
    ${sec('uso','Uso do app',`Hoje: ${n0(P.dia&&P.dia.visitantes)} visitantes · ${n0(P.dia&&P.dia.cadastros)} cadastros`,
      `<table><thead><tr><th></th><th>Hoje</th><th>7 dias</th><th>30 dias</th></tr></thead><tbody>
      ${LINHAS.map(([k,l,h])=>`<tr title="${esc(h)}"><td>${l}<small>${h}</small></td><td>${n0(P.dia&&P.dia[k])}</td><td>${n0(P.semana&&P.semana[k])}</td><td>${n0(P.mes&&P.mes[k])}</td></tr>`).join('')}
      </tbody></table>`)}
    ${sec('serie','Visitantes por dia','Últimos 14 dias',
      `<div class="bars" role="img" aria-label="Visitantes nos últimos 14 dias">${serie.map((s,i)=>`<div title="${dataBR(s.dia)}: ${s.visitantes} visitantes"><i class="${i===serie.length-1?'hoje':''}" style="height:${s.visitantes/mx*100}%"></i><span>${diaCurto(s.dia)}</span></div>`).join('')}</div>
      <p class="legend" style="margin:0">A barra amarela é hoje.</p>`)}
    ${sec('cliques','Botões mais clicados','Últimos 30 dias',rank(d.top_cliques,'Ainda sem cliques.'))}
    ${sec('abas','Abas mais usadas','Últimos 30 dias',rank(d.top_abas,'Ainda sem dados.'))}
    ${sec('lugares','Ilhas e praias mais vistas','Últimos 30 dias',rank(d.top_lugares,'Ainda sem dados.'))}
    ${sec('widget','Widget no iPhone','Números na tela inicial',`<div id="ad-wg" style="display:grid;gap:10px">
      <p class="legend" style="margin:0">Mostra na tela inicial e na tela bloqueada quantas pessoas estão online, visitantes, cadastros e cliques de hoje. O iPhone atualiza sozinho mais ou menos a cada 5 a 15 minutos.</p>
      <ol style="margin:0;padding-left:20px;display:grid;gap:6px;font-size:.92rem">
        <li>Instale o app grátis <b>Scriptable</b> na App Store.</li>
        <li>Neste iPhone, toque em <button type="button" class="linkbtn" id="wg-copiar">copiar script</button>.</li>
        <li>No Scriptable, toque em <b>+</b>, cole o script e salve com o nome <b>Limamar</b>.</li>
        <li>Tela inicial: segure o dedo, toque em <b>+</b> (ou Editar › Adicionar widget), escolha <b>Scriptable</b>, tamanho médio, depois toque no widget e escolha o script Limamar.</li>
        <li>Tela bloqueada: segure o dedo, <b>Personalizar</b> › Tela Bloqueada, adicione o widget Scriptable e escolha o script Limamar.</li>
      </ol>
      <p class="legend" style="margin:0">Não compartilhe o script: ele leva a chave secreta dos números. Se ele vazar, toque em <button type="button" class="linkbtn" id="wg-nova">trocar a chave</button> (o widget antigo para de funcionar e você copia o script de novo).</p>
    </div>`)}
    ${sec('pushover','Avisos com som (Pushover)','Som para cada tipo de aviso','<div id="ad-po" style="display:grid;gap:10px"><p class="empty">Carregando…</p></div>')}
    ${sec('ntfy','Avisos no app ntfy','Aviso simples, sem escolher som','<div id="ad-ntfy" style="display:grid;gap:10px"><p class="empty">Carregando…</p></div>')}
    <p class="legend" style="margin:0">Atualizado ${quando(d.agora)}. Seus próprios cliques dentro da administração não entram na conta.</p>
  </div>`;
  avisos();pushover();widget();
}

/* ---------- widget do iPhone (Scriptable) ---------- */
function scriptWidget(chave){
  const url='https://gmqkbxxwutgntrnrqwjm.supabase.co/rest/v1/rpc/widget_estatisticas';
  const apikey='sb_publishable_Tf3vFF5ygNld9fWY8dP2rQ_dYnb7iV5';
  return `// Limamar — números ao vivo (widget)
// Cole no app Scriptable. Não compartilhe: a chave abaixo é secreta.
const CHAVE = ${JSON.stringify(chave)};
const URL_NUMEROS = ${JSON.stringify(url)};
const APIKEY = ${JSON.stringify(apikey)};
const AREIA = new Color("#e9b949"), MAR = new Color("#0f5a6b"), VERDE = new Color("#4cc37e");

async function carrega() {
  try {
    const r = new Request(URL_NUMEROS);
    r.method = "POST";
    r.headers = { "apikey": APIKEY, "Content-Type": "application/json" };
    r.body = JSON.stringify({ chave: CHAVE });
    r.timeoutInterval = 15;
    const d = await r.loadJSON();
    if (d && d.ready) { Keychain.set("limamar-numeros", JSON.stringify(d)); return d; }
  } catch (e) {}
  return Keychain.contains("limamar-numeros") ? JSON.parse(Keychain.get("limamar-numeros")) : null;
}

const n = (v) => new Intl.NumberFormat("pt-BR").format(v || 0);
const d = await carrega();
const fam = config.widgetFamily || "medium";
const w = new ListWidget();
w.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
w.url = "https://nathaemp.github.io/limar/";

if (!d) {
  w.addText("Limamar: sem dados");
} else if (fam === "accessoryInline") {
  w.addText(\`⚓ \${n(d.online)} online · \${n(d.cadastros.day)} cadastros hoje\`);
} else if (fam === "accessoryCircular") {
  const t = w.addText(n(d.online)); t.font = Font.boldSystemFont(22); t.centerAlignText();
  const s = w.addText("online"); s.font = Font.systemFont(9); s.centerAlignText();
} else if (fam === "accessoryRectangular") {
  const a = w.addText(\`⚓ \${n(d.online)} online agora\`); a.font = Font.boldSystemFont(14);
  const b = w.addText(\`Hoje: \${n(d.visitantes.day)} visitantes · \${n(d.cadastros.day)} cadastros\`); b.font = Font.systemFont(11);
  const c = w.addText(\`\${n(d.cliques.day)} cliques · \${n(d.usuarios)} contas\`); c.font = Font.systemFont(11);
} else {
  w.backgroundColor = MAR;
  const h = w.addText("LIMAMAR · HOJE"); h.font = Font.semiboldSystemFont(10); h.textColor = AREIA;
  w.addSpacer(4);
  const o = w.addText(\`● \${n(d.online)} online agora\`); o.font = Font.boldSystemFont(fam === "small" ? 16 : 20); o.textColor = VERDE;
  w.addSpacer(6);
  const linhas = [["Visitantes", d.visitantes], ["Usuários ativos", d.ativos], ["Cadastros", d.cadastros], ["E-mails confirmados", d.confirmados], ["Cliques", d.cliques]];
  for (const [rotulo, p] of (fam === "small" ? linhas.slice(0, 3) : linhas)) {
    const s = w.addStack();
    const l = s.addText(rotulo); l.font = Font.systemFont(11); l.textColor = Color.white();
    s.addSpacer();
    const v = s.addText(fam === "small" ? n(p.day) : \`\${n(p.day)}  ·  7d \${n(p.week)}\`); v.font = Font.boldMonospacedSystemFont(11); v.textColor = Color.white();
  }
  w.addSpacer();
  const u = w.addText(\`\${n(d.usuarios)} contas · atualizado \${new Date(d.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\`);
  u.font = Font.systemFont(8); u.textColor = new Color("#d6e8ea");
}

if (config.runsInWidget) Script.setWidget(w);
else await w.presentMedium();
Script.complete();
`;
}
// No iPhone, copiar só funciona se for feito na hora do toque (sem esperar a internet).
// Por isso a chave é buscada antes, quando o quadro aparece.
function copiaNaHora(t){
  let ok=false;
  const a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.cssText='position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.appendChild(a);a.focus();a.select();try{a.setSelectionRange(0,t.length)}catch(e){}
  try{ok=document.execCommand('copy')}catch(e){}
  a.remove();
  if(navigator.clipboard&&navigator.clipboard.writeText){try{navigator.clipboard.writeText(t).catch(()=>{});ok=true}catch(e){}}
  return ok;
}
let wgChave=null;
async function widget(){
  const c=$('wg-copiar'),nv=$('wg-nova');if(!c)return;
  const box=$('ad-wg');
  const mostra=t=>{let ta=box.querySelector('textarea.wg-txt');
    if(!ta){ta=document.createElement('textarea');ta.className='wg-txt';ta.readOnly=true;ta.rows=6;
      ta.style.cssText='width:100%;font-family:var(--mono);font-size:12px;border:1px solid var(--line);border-radius:10px;padding:8px;background:var(--surface);color:var(--ink)';
      const p=document.createElement('p');p.className='legend';p.style.margin='0';p.textContent='Se não copiou sozinho: toque no quadro abaixo, toque em Selecionar Tudo e depois em Copiar.';
      box.appendChild(p);box.appendChild(ta)}
    ta.value=t;ta.onfocus=()=>{ta.select();try{ta.setSelectionRange(0,t.length)}catch(e){}}};
  c.textContent='carregando…';
  if(!wgChave){const {data,error}=await sb.rpc('admin_widget_chave',{nova:false});if(error){c.textContent='copiar script';return msg(erroTxt(error))}wgChave=data}
  c.textContent='copiar script';
  c.onclick=()=>{const t=scriptWidget(wgChave);const ok=copiaNaHora(t);mostra(t);
    msg(ok?'Script copiado. Agora abra o Scriptable, toque em + e cole.':'Não deu para copiar sozinho: use o quadro que apareceu embaixo.',ok?'ok':'err')};
  nv.onclick=async()=>{if(!nv.classList.contains('sure')){nv.classList.add('sure');nv.textContent='toque de novo para trocar';setTimeout(()=>{if(nv.isConnected){nv.classList.remove('sure');nv.textContent='trocar a chave'}},4000);return}
    const {data,error}=await sb.rpc('admin_widget_chave',{nova:true});if(error)return msg(erroTxt(error));
    wgChave=data;mostra(scriptWidget(data));msg('Chave trocada. Toque em copiar script e cole no Scriptable no lugar do antigo.','ok')};
}

/* ---------- avisos com som (Pushover) ---------- */
const SONS=[['pushover','Pushover (padrão)'],['tugboat','Rebocador (buzina de barco)'],['cashregister','Caixa registradora'],['magic','Mágica'],['bugle','Corneta'],
  ['bike','Campainha de bicicleta'],['incoming','Chegando'],['intermission','Intervalo'],['classical','Clássico'],['cosmic','Cósmico'],['falling','Caindo'],
  ['gamelan','Gamelão'],['mechanical','Mecânico'],['pianobar','Piano bar'],['siren','Sirene'],['spacealarm','Alarme espacial'],['alien','Alien (longo)'],
  ['climb','Subida (longo)'],['persistent','Persistente (longo)'],['echo','Eco (longo)'],['updown','Sobe e desce (longo)'],['vibrate','Só vibrar'],['none','Sem som']];
const TIPOS=[['cadastro','Cadastro novo','tugboat'],['confirmado','E-mail confirmado','magic']];
let poInfo=null,poSons={};
async function pushover(){
  const box=$('ad-po');if(!box)return;
  if(!poInfo){try{const {data,error}=await sb.rpc('admin_pushover');if(error)throw error;poInfo=data;
      poSons=Object.fromEntries(TIPOS.map(([k,,d])=>[k,(data.sons||{})[k]||d]))}
    catch(e){box.innerHTML='<p class="empty">'+esc(erroTxt(e))+'</p>';return}}
  const on=poInfo.configurado;
  box.innerHTML=`
    <p class="legend" style="margin:0">${on?'Ligado. Escolha o som de cada aviso e toque em <b>Testar</b> para ouvir no celular.'
      :'Instale o app <b>Pushover</b> e crie a conta. No site <b>pushover.net</b>, copie a sua <b>User Key</b> e crie um aplicativo (<i>Create an Application</i>) para pegar a <b>API Token</b>. Cole as duas aqui.'}</p>
    <div class="cols" style="gap:8px">
      <label class="f">User Key<input type="password" id="po-u" autocomplete="off" placeholder="${on?'(salva)':'cole aqui'}"></label>
      <label class="f">API Token<input type="password" id="po-t" autocomplete="off" placeholder="${on?'(salva)':'cole aqui'}"></label></div>
    ${TIPOS.map(([k,l])=>`<div class="inline" style="grid-template-columns:1fr auto auto;align-items:center"><span>${l}</span>
      <select class="sel" data-som="${k}" aria-label="Som para ${l}" style="padding:8px">${SONS.map(([v,n])=>`<option value="${v}" ${poSons[k]===v?'selected':''}>${n}</option>`).join('')}</select>
      <button type="button" class="ghost" data-teste="${k}" style="padding:8px 12px">Testar</button></div>`).join('')}
    <div class="acts"><button type="button" id="po-salvar">${on?'Salvar sons':'Ligar Pushover'}</button>${on?'<button type="button" class="ghost" id="po-off">Desligar</button>':''}</div>`;
  box.querySelectorAll('[data-som]').forEach(sl=>sl.onchange=()=>{poSons[sl.dataset.som]=sl.value});
  const salvar=async teste=>{
    const u=$('po-u').value.trim(),t=$('po-t').value.trim();
    const {data:envio,error}=await sb.rpc('admin_pushover_salvar',{usuario:u||null,token:t||null,sons:poSons,teste,desligar:false});
    if(error)return msg(erroTxt(error));
    poInfo=null;msg('Enviando o teste…','ok');
    // espera o Pushover responder
    for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,1000));
      const {data:r}=await sb.rpc('admin_pushover_resultado',{envio});
      if(r&&r.status){if(r.status===200)msg('Teste enviado: deve tocar no celular agora.','ok');
        else msg('O Pushover recusou ('+r.status+'). Confira a User Key e a API Token. '+(r.erro||''));break}}
    pushover()};
  box.querySelectorAll('[data-teste]').forEach(b=>b.onclick=()=>salvar(b.dataset.teste));
  $('po-salvar').onclick=()=>salvar('cadastro');
  if($('po-off'))$('po-off').onclick=async()=>{const {error}=await sb.rpc('admin_pushover_salvar',{usuario:null,token:null,sons:null,teste:null,desligar:true});
    if(error)return msg(erroTxt(error));poInfo=null;msg('Pushover desligado.','ok');pushover()};
}

/* ---------- avisos no celular (app ntfy) ---------- */
let ntfyLido=false,ntfyCanal=null;
async function avisos(){
  const box=$('ad-ntfy');if(!box)return;
  if(!ntfyLido){try{const {data,error}=await sb.rpc('admin_ntfy');if(error)throw error;ntfyCanal=data||null;ntfyLido=true}catch(e){box.innerHTML='<p class="empty">'+esc(erroTxt(e))+'</p>';return}}
  box.innerHTML=`
    <p class="legend" style="margin:0">Chega na hora no iPhone, mesmo com o app fechado: cada <b>cadastro novo</b> e cada <b>e-mail confirmado</b>. Instale o app <b>ntfy</b>, toque em <b>+</b> e assine o canal abaixo (servidor ntfy.sh). Quem souber o nome do canal consegue ler os avisos, então não divulgue.</p>
    <div class="inline"><label class="f">Canal<input type="text" id="nt-canal" value="${esc(ntfyCanal||'')}" maxlength="64" autocomplete="off" spellcheck="false"></label>
      <button type="button" id="nt-salvar">${ntfyCanal?'Enviar teste':'Ligar'}</button></div>
    <p class="legend" style="margin:0">${ntfyCanal?'Ligado no canal '+esc(ntfyCanal)+'.':'Desligado.'}${ntfyCanal?' <button type="button" class="linkbtn" id="nt-off">Desligar</button>':''}</p>`;
  const inp=$('nt-canal');inp.oninput=()=>{inp.value=inp.value.replace(/[^A-Za-z0-9_-]/g,'');$('nt-salvar').textContent=inp.value===ntfyCanal?'Enviar teste':'Salvar e testar'};
  $('nt-salvar').onclick=async()=>{const c=inp.value.trim();if(c.length<8)return msg('O nome do canal precisa de pelo menos 8 letras ou números.');
    const {error}=await sb.rpc('admin_ntfy_salvar',{canal:c});if(error)return msg(erroTxt(error));ntfyCanal=c;msg('Aviso de teste enviado para o canal '+c+'.','ok');avisos()};
  if($('nt-off'))$('nt-off').onclick=async()=>{const {error}=await sb.rpc('admin_ntfy_salvar',{canal:''});if(error)return msg(erroTxt(error));ntfyCanal=null;msg('Avisos desligados.','ok');avisos()};
}

/* ---------- usuários ---------- */
const FILTROS=[['todos','Todos'],['online','Online'],['cortesia','Cortesia'],['bloqueado','Bloqueados'],['pendente','Sem confirmar']];
function usuarios(){
  const q=busca.toLowerCase();
  const lista=USERS.filter(u=>(filtro==='todos'||(filtro==='online'&&u.online)||(filtro==='cortesia'&&u.cortesia)||(filtro==='bloqueado'&&u.bloqueado)||(filtro==='pendente'&&!u.confirmado))
    &&(!q||[u.nome,u.email,u.barco,u.funcao].some(v=>v&&String(v).toLowerCase().includes(q))));
  $('ad-body').innerHTML=`<div style="display:grid;gap:12px">
    <input type="search" id="ad-q" placeholder="Buscar por nome, e-mail ou barco" value="${esc(busca)}" aria-label="Buscar usuário">
    <div class="filters">${FILTROS.map(([k,l])=>`<button type="button" data-f="${k}" aria-pressed="${filtro===k}">${l} (${USERS.filter(u=>k==='todos'||(k==='online'&&u.online)||(k==='cortesia'&&u.cortesia)||(k==='bloqueado'&&u.bloqueado)||(k==='pendente'&&!u.confirmado)).length})</button>`).join('')}</div>
    <p class="legend" style="margin:0">Toque em uma pessoa para ver os detalhes e as ações. Bolinhas: verde online, amarela cortesia, vermelha bloqueado, laranja e-mail não confirmado.</p>
    ${lista.length?lista.map(cartao).join(''):'<p class="empty">Nenhum usuário encontrado.</p>'}
  </div>`;
  const qi=$('ad-q');qi.oninput=()=>{busca=qi.value;const pos=qi.selectionStart;usuarios();const n=$('ad-q');n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}};
  root.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{filtro=b.dataset.f;usuarios()});
  root.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>acao(b));
}
function cartao(u){
  const ini=esc(((u.nome||u.email||'?').trim()[0]||'?').toUpperCase());
  const tags=[u.admin&&'<span class="tag gold">Administrador</span>',u.online&&'<span class="tag ok">Online</span>',
    u.cortesia&&`<span class="tag gold">Cortesia${u.cortesia_ate?' até '+dataBR(u.cortesia_ate):''}</span>`,
    u.bloqueado&&'<span class="tag bad">Bloqueado</span>',!u.confirmado&&'<span class="tag warn">E-mail não confirmado</span>',
    u.confirmado&&!u.cadastro_ok&&'<span class="tag warn">Cadastro incompleto</span>'].filter(Boolean).join('');
  const acts=u.admin?'':`
    ${u.cortesia?`<button type="button" class="ghost" data-act="tirar-cortesia" data-email="${esc(u.email)}">Remover cortesia</button>`
      :`<button type="button" class="ghost" data-act="dar-cortesia" data-email="${esc(u.email)}">Dar cortesia</button>`}
    <button type="button" class="ghost" data-act="${u.bloqueado?'desbloquear':'bloquear'}" data-id="${u.id}">${u.bloqueado?'Desbloquear':'Bloquear'}</button>
    <button type="button" class="danger" data-act="excluir" data-id="${u.id}">Excluir</button>`;
  const pontos=[u.online&&'<i style="background:var(--go)" title="Online"></i>',u.cortesia&&'<i style="background:var(--sand)" title="Cortesia"></i>',
    u.bloqueado&&'<i style="background:var(--stop)" title="Bloqueado"></i>',!u.confirmado&&'<i style="background:var(--warn)" title="E-mail não confirmado"></i>'].filter(Boolean).join('');
  return `<details class="user" data-sec="u-${u.id}"${ABERTAS.has('u-'+u.id)?' open':''} data-u="${u.id}">
    <summary><div class="av">${u.foto?`<img src="${esc(u.foto)}" alt="">`:ini}</div>
      <div style="min-width:0"><div class="nm">${esc(u.nome||'(sem nome)')}</div><div class="em">${esc(u.email)}</div></div>
      <span class="mini">${pontos}<span class="chev" aria-hidden="true">▶</span></span></summary>
    <div class="user-in">
    ${tags?`<div class="tags">${tags}</div>`:''}
    <div class="legend">${[u.funcao,u.barco&&'Barco '+u.barco].filter(Boolean).map(esc).join(' · ')||'—'}</div>
    <div class="legend">Conta criada ${quando(u.criado)} · último uso ${quando(u.visto||u.ultimo_login)}</div>
    ${acts?`<div class="acts">${acts}</div>`:''}
    <div class="extra"></div>
  </div></details>`;
}
async function acao(b){
  const a=b.dataset.act,id=b.dataset.id,email=b.dataset.email;
  try{
    if(a==='dar-cortesia'){
      const box=b.closest('details.user').querySelector('.extra');
      box.innerHTML=`<div class="inline"><label class="f">Cortesia até (deixe vazio para sem prazo)<input type="date" class="ct-ate"></label><button type="button" class="ct-ok">Dar</button></div>`;
      box.querySelector('.ct-ok').onclick=async()=>{const ate=box.querySelector('.ct-ate').value||null;
        const {error}=await sb.rpc('admin_cortesia_salvar',{e_mail:email,valida_ate:ate,observacao:'Dada pela lista de usuários'});if(error)return msg(erroTxt(error));
        msg('Cortesia liberada para '+email+'.','ok');carrega(true)};return;
    }
    if(a==='tirar-cortesia'){const {error}=await sb.rpc('admin_cortesia_remover',{e_mail:email});if(error)throw error;msg('Cortesia removida.','ok');return carrega(true)}
    if(a==='bloquear'||a==='desbloquear'){
      if(a==='bloquear'&&!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Toque de novo para bloquear';setTimeout(()=>{b.classList.remove('sure');b.textContent='Bloquear'},4000);return}
      const {error}=await sb.rpc('admin_bloquear',{usuario:id,bloquear:a==='bloquear'});if(error)throw error;
      msg(a==='bloquear'?'Usuário bloqueado. Ele não consegue mais entrar.':'Usuário desbloqueado.','ok');return carrega(true)}
    if(a==='excluir'){
      if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Toque de novo para excluir para sempre';setTimeout(()=>{if(b.isConnected){b.classList.remove('sure');b.textContent='Excluir'}},5000);return}
      b.disabled=true;b.textContent='Excluindo…';
      try{const {data}=await sb.storage.from('avatars').list(id);if(data&&data.length)await sb.storage.from('avatars').remove(data.map(f=>id+'/'+f.name))}catch(e){}
      const {error}=await sb.rpc('admin_excluir_usuario',{usuario:id});if(error)throw error;
      msg('Usuário excluído.','ok');return carrega(true)}
  }catch(e){msg(erroTxt(e))}
}

/* ---------- cortesias ---------- */
function cortesias(lista){
  $('ad-body').innerHTML=`<div style="display:grid;gap:14px">
    ${sec('dar-cortesia','+ Dar cortesia','Por e-mail, com ou sem prazo',`
      <p class="legend" style="margin:0">Vale para o e-mail mesmo que a pessoa ainda não tenha conta. Quando ela se cadastrar com esse e-mail, já entra com a cortesia.</p>
      <form id="ct-form" style="display:grid;gap:10px" novalidate>
        <label class="f">E-mail<input type="email" id="ct-email" required placeholder="nome@exemplo.com" inputmode="email"></label>
        <label class="f">Válida até (vazio = sem prazo)<input type="date" id="ct-ate"></label>
        <label class="f">Observação (opcional)<input type="text" id="ct-nota" maxlength="200" placeholder="Ex.: parceiro, barqueiro do cais"></label>
        <button type="submit">Salvar cortesia</button>
      </form>`)}
    <div class="panel"><h2 style="font-size:1.3rem">Cortesias (${lista.length})</h2>
      ${lista.length?lista.map(c=>`<div class="user"><div style="display:grid;gap:4px">
          <div class="nm">${esc(c.email)}</div>
          <div class="tags"><span class="tag ${c.ativa?'ok':'bad'}">${c.ativa?'Ativa':'Vencida'}${c.ate?' · até '+dataBR(c.ate):' · sem prazo'}</span><span class="tag ${c.tem_conta?'':'warn'}">${c.tem_conta?'Já tem conta':'Ainda sem conta'}</span></div>
          ${c.nota?`<div class="legend">${esc(c.nota)}</div>`:''}<div class="legend">Criada ${quando(c.criada)}</div></div>
          <div class="acts"><button type="button" class="danger" data-rm="${esc(c.email)}">Remover cortesia</button></div></div>`).join('')
        :'<p class="empty">Nenhuma cortesia ainda.</p>'}
    </div></div>`;
  $('ct-form').onsubmit=async e=>{e.preventDefault();const email=$('ct-email').value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return msg('Confira o e-mail.');
    const {error}=await sb.rpc('admin_cortesia_salvar',{e_mail:email,valida_ate:$('ct-ate').value||null,observacao:$('ct-nota').value});
    if(error)return msg(erroTxt(error));msg('Cortesia salva para '+email+'.','ok');carrega(true)};
  root.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{
    if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Toque de novo para remover';setTimeout(()=>{if(b.isConnected){b.classList.remove('sure');b.textContent='Remover cortesia'}},4000);return}
    const {error}=await sb.rpc('admin_cortesia_remover',{e_mail:b.dataset.rm});if(error)return msg(erroTxt(error));msg('Cortesia removida.','ok');carrega(true)});
}

window.LM_ADMIN={abrir,fechar};
})();
