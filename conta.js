/* Limamar · conta do usuário (Supabase Auth)
   Entrar, criar conta com confirmação por e-mail, recuperar senha, concluir cadastro,
   foto de perfil, trocar senha, sair e excluir conta. Depois de entrar uma vez, o app
   abre sem internet (no mar) com a sessão salva no celular. */
(()=>{
"use strict";
const CFG={
  url:'https://gmqkbxxwutgntrnrqwjm.supabase.co',
  key:'sb_publishable_Tf3vFF5ygNld9fWY8dP2rQ_dYnb7iV5',   // chave pública: pode ficar no app
  turnstile:''     // site key do Cloudflare Turnstile (captcha), quando ativado
};
const $=id=>document.getElementById(id);
const html=document.documentElement;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const ls={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const REDIRECT=location.origin+location.pathname.replace(/index\.html$/,'');
const FUNCOES=['Barqueiro','Marinheiro','Mestre / Arrais','Dono de embarcação','Guia de turismo','Outro'];

// Enquanto o servidor de contas não estiver configurado, o app fica aberto como antes.
if(!window.LM_AUTH||!CFG.url||!CFG.key||!window.supabase){html.classList.remove('locked');return}

const sb=window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'lm-auth'}});
let user=null, perfil=ls.get('lm-perfil');

/* ---------- trava / destrava ---------- */
const auth=$('auth');
function unlock(){html.classList.remove('locked');auth.hidden=true;auth.innerHTML='';$('acct-btn').hidden=false;drawBtn()}
function lock(view,msg){html.classList.add('locked');auth.hidden=false;$('acct-btn').hidden=true;go(view||'entrar',msg)}
function setOK(u){ls.set('lm-ok',{id:u.id,email:u.email,t:Date.now()})}
function clearLocal(){ls.del('lm-ok');ls.del('lm-perfil');perfil=null;user=null}

/* ---------- captcha (Cloudflare Turnstile) ---------- */
let tsLoaded=null,tsWidget=null;
function captcha(el){
  if(!CFG.turnstile||!el)return;
  tsLoaded=tsLoaded||new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
  tsLoaded.then(()=>{tsWidget=window.turnstile.render(el,{sitekey:CFG.turnstile,language:'pt-br',theme:'auto'})}).catch(()=>{el.textContent='Não consegui carregar a verificação. Confira a internet.'});
}
function captchaToken(){if(!CFG.turnstile)return undefined;try{return window.turnstile.getResponse(tsWidget)||null}catch(e){return null}}
function captchaReset(){try{if(CFG.turnstile&&tsWidget!=null)window.turnstile.reset(tsWidget)}catch(e){}}

/* ---------- mensagens ---------- */
function traduz(e){
  const m=(e&&(e.message||e.error_description||e))+'';
  if(/Invalid login credentials/i.test(m))return 'E-mail ou senha incorretos.';
  if(/Email not confirmed/i.test(m))return 'Você ainda não confirmou seu e-mail. Abra a mensagem que mandamos e toque no link.';
  if(/User already registered/i.test(m))return 'Esse e-mail já tem conta. Entre ou recupere a senha.';
  if(/Password should be at least|weak/i.test(m))return 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.';
  if(/rate limit|too many|security purposes/i.test(m))return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  if(/captcha/i.test(m))return 'Faça a verificação de segurança antes de continuar.';
  if(/expired|invalid.*(link|token)|otp/i.test(m))return 'O link expirou ou já foi usado. Peça um novo.';
  if(/same.*password|different from the old/i.test(m))return 'A nova senha precisa ser diferente da atual.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Sem conexão com a internet. Conecte e tente de novo.';
  return 'Algo deu errado: '+m;
}
const msgBox=(t,c)=>t?`<p class="msg ${c||'err'}" role="${c==='ok'||c==='info'?'status':'alert'}">${t}</p>`:'';
const pwField=(id,label,auto,hint)=>`<label class="f">${label}<span class="pw"><input type="password" id="${id}" autocomplete="${auto}" required minlength="8"><button type="button" data-eye="${id}">Mostrar</button></span>${hint?`<span class="hint">${hint}</span>`:''}</label>`;
function wireEyes(root){root.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>{const i=$(b.dataset.eye);const s=i.type==='password';i.type=s?'text':'password';b.textContent=s?'Ocultar':'Mostrar'})}
const senhaOk=p=>p.length>=8&&/[A-Za-z]/.test(p)&&/\d/.test(p);
function busy(form,on,label){const b=form.querySelector('button[type=submit]');if(!b)return;if(on){b.dataset.t=b.textContent;b.textContent=label||'Aguarde…'}else b.textContent=b.dataset.t||b.textContent;b.disabled=on}

/* ---------- telas de entrada ---------- */
const brand=`<div class="brand"><div class="eyebrow">Navegação em Paraty</div><h1>Limamar</h1><p>Vento, mar, maré e carta náutica da baía de Paraty.</p></div>`;
let lastEmail='';
function go(view,msg){
  tsWidget=null;
  const V=VIEWS[view]||VIEWS.entrar;
  auth.innerHTML=`<div class="box">${brand}${V.html(msg)}</div>`;
  wireEyes(auth);V.wire&&V.wire();
  auth.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  captcha(auth.querySelector('.cf-turnstile'));
  const f=auth.querySelector('input');if(f&&!('ontouchstart' in window))f.focus();
}
const VIEWS={
  entrar:{html:m=>`<h2>Entrar</h2>${msgBox(m&&m.t,m&&m.c)}
    <form id="fm" novalidate>
      <label class="f">E-mail<input type="email" id="a-email" autocomplete="email" inputmode="email" required value="${esc(lastEmail)}"></label>
      ${pwField('a-senha','Senha','current-password')}
      <div class="cf-turnstile"></div><span id="a-msg"></span>
      <button type="submit">Entrar</button>
    </form>
    <div class="links"><button type="button" data-go="criar">Criar conta</button><button type="button" data-go="esqueci">Esqueci a senha</button></div>`,
    wire(){$('fm').onsubmit=async e=>{e.preventDefault();const f=e.target;
      const email=$('a-email').value.trim(),password=$('a-senha').value;lastEmail=email;
      if(!email||!password){$('a-msg').innerHTML=msgBox('Preencha e-mail e senha.');return}
      const tk=captchaToken();if(tk===null){$('a-msg').innerHTML=msgBox(traduz('captcha'));return}
      busy(f,true,'Entrando…');
      const {data,error}=await sb.auth.signInWithPassword({email,password,options:{captchaToken:tk}});
      busy(f,false);captchaReset();
      if(error){const nc=/Email not confirmed/i.test(error.message);
        $('a-msg').innerHTML=msgBox(traduz(error))+(nc?`<button type="button" class="ghost" id="a-reenv" style="width:100%">Reenviar e-mail de confirmação</button>`:'');
        if(nc)$('a-reenv').onclick=()=>go('confirme');return}
      await entrou(data.user);
    }}},
  criar:{html:()=>`<h2>Criar conta</h2>
    <form id="fm" novalidate>
      <label class="f">Seu nome<input type="text" id="c-nome" autocomplete="name" required maxlength="80"></label>
      <label class="f">E-mail<input type="email" id="c-email" autocomplete="email" inputmode="email" required value="${esc(lastEmail)}"></label>
      ${pwField('c-senha','Senha','new-password','Pelo menos 8 caracteres, com letras e números.')}
      ${pwField('c-senha2','Repita a senha','new-password')}
      <label class="chk"><input type="checkbox" id="c-ok" required><span>Entendo que o Limamar é uma ajuda para planejar e não substitui a carta oficial, os avisos da Marinha nem o julgamento do comandante.</span></label>
      <div class="cf-turnstile"></div><span id="a-msg"></span>
      <button type="submit">Criar conta</button>
    </form>
    <div class="links"><button type="button" data-go="entrar">Já tenho conta</button></div>`,
    wire(){$('fm').onsubmit=async e=>{e.preventDefault();const f=e.target,M=t=>$('a-msg').innerHTML=msgBox(t);
      const nome=$('c-nome').value.trim(),email=$('c-email').value.trim(),p1=$('c-senha').value,p2=$('c-senha2').value;lastEmail=email;
      if(nome.length<2)return M('Escreva seu nome.');
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return M('Confira o e-mail.');
      if(!senhaOk(p1))return M(traduz('weak'));
      if(p1!==p2)return M('As duas senhas não são iguais.');
      if(!$('c-ok').checked)return M('Marque a caixa de ciência para continuar.');
      const tk=captchaToken();if(tk===null)return M(traduz('captcha'));
      busy(f,true,'Criando…');
      const {data,error}=await sb.auth.signUp({email,password:p1,options:{emailRedirectTo:REDIRECT,data:{nome},captchaToken:tk}});
      busy(f,false);captchaReset();
      if(error)return M(traduz(error));
      if(data.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0)return M(traduz('User already registered'));
      if(data.session){await entrou(data.user);return}   // confirmação desligada no servidor
      go('confirme');
    }}},
  confirme:{html:()=>`<h2>Confirme seu e-mail</h2>
    <p class="msg info">Mandamos um link para <b>${esc(lastEmail)}</b>. Abra a mensagem e toque em <b>Confirmar e-mail</b>. Se não achar, olhe no Spam ou em Promoções.</p>
    <p class="hint" style="margin:0">Depois de confirmar, volte aqui e entre com seu e-mail e senha.</p>
    <span id="a-msg"></span>
    <button type="button" id="a-reenv" class="ghost">Reenviar e-mail</button>
    <button type="button" data-go="entrar">Já confirmei, entrar</button>`,
    wire(){let wait=0,tm=null;const b=$('a-reenv');
      const tick=()=>{if(wait>0){b.disabled=true;b.textContent='Reenviar em '+wait+' s';wait--;tm=setTimeout(tick,1000)}else{b.disabled=false;b.textContent='Reenviar e-mail'}};
      b.onclick=async()=>{if(!lastEmail){go('entrar');return}
        const {error}=await sb.auth.resend({type:'signup',email:lastEmail,options:{emailRedirectTo:REDIRECT}});
        $('a-msg').innerHTML=error?msgBox(traduz(error)):msgBox('E-mail reenviado.','ok');wait=60;tick()};
    }},
  esqueci:{html:()=>`<h2>Recuperar senha</h2>
    <p class="hint" style="margin:0">Escreva o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.</p>
    <form id="fm" novalidate>
      <label class="f">E-mail<input type="email" id="r-email" autocomplete="email" inputmode="email" required value="${esc(lastEmail)}"></label>
      <div class="cf-turnstile"></div><span id="a-msg"></span>
      <button type="submit">Mandar link</button>
    </form>
    <div class="links"><button type="button" data-go="entrar">Voltar</button></div>`,
    wire(){$('fm').onsubmit=async e=>{e.preventDefault();const f=e.target;const email=$('r-email').value.trim();lastEmail=email;
      if(!email){$('a-msg').innerHTML=msgBox('Escreva o e-mail.');return}
      const tk=captchaToken();if(tk===null){$('a-msg').innerHTML=msgBox(traduz('captcha'));return}
      busy(f,true,'Enviando…');
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:REDIRECT,captchaToken:tk});
      busy(f,false);captchaReset();
      $('a-msg').innerHTML=error?msgBox(traduz(error)):msgBox('Se esse e-mail tiver conta, o link chega em instantes. Olhe também no Spam.','ok');
    }}},
  nova:{html:()=>`<h2>Senha nova</h2>
    <form id="fm" novalidate>
      ${pwField('n-senha','Nova senha','new-password','Pelo menos 8 caracteres, com letras e números.')}
      ${pwField('n-senha2','Repita a nova senha','new-password')}
      <span id="a-msg"></span>
      <button type="submit">Salvar senha</button>
    </form>`,
    wire(){$('fm').onsubmit=async e=>{e.preventDefault();const f=e.target,M=t=>$('a-msg').innerHTML=msgBox(t);
      const p1=$('n-senha').value,p2=$('n-senha2').value;
      if(!senhaOk(p1))return M(traduz('weak'));if(p1!==p2)return M('As duas senhas não são iguais.');
      busy(f,true,'Salvando…');const {data,error}=await sb.auth.updateUser({password:p1});busy(f,false);
      if(error)return M(traduz(error));
      await entrou(data.user,'Senha trocada.');
    }}},
  concluir:{html:()=>`<h2>Concluir cadastro</h2>
    <p class="msg ok">E-mail confirmado. Falta pouco.</p>
    <form id="fm" novalidate>
      <label class="f">Seu nome<input type="text" id="p-nome" required maxlength="80" value="${esc(perfil&&perfil.nome)}"></label>
      <label class="f">Você é<select id="p-funcao" class="sel">${['',...FUNCOES].map(f=>`<option ${perfil&&perfil.funcao===f?'selected':''} value="${esc(f)}">${f||'Escolha'}</option>`).join('')}</select></label>
      <label class="f">Nome da embarcação (opcional)<input type="text" id="p-barco" maxlength="80" value="${esc(perfil&&perfil.barco)}"></label>
      <span id="a-msg"></span>
      <button type="submit">Começar a usar</button>
    </form>`,
    wire(){$('fm').onsubmit=async e=>{e.preventDefault();const f=e.target,M=t=>$('a-msg').innerHTML=msgBox(t);
      const nome=$('p-nome').value.trim(),funcao=$('p-funcao').value,barco=$('p-barco').value.trim();
      if(nome.length<2)return M('Escreva seu nome.');if(!funcao)return M('Escolha o que você faz.');
      busy(f,true,'Salvando…');const err=await salvaPerfil({nome,funcao,barco:barco||null,cadastro_ok:true});busy(f,false);
      if(err)return M(traduz(err));
      unlock();
    }}}
};

/* ---------- perfil ---------- */
async function carregaPerfil(){
  const {data,error}=await sb.from('profiles').select('nome,funcao,barco,avatar_url,plano,plano_ate,cadastro_ok').eq('id',user.id).maybeSingle();
  if(error)throw error;
  perfil=data||{nome:(user.user_metadata||{}).nome||'',cadastro_ok:false};ls.set('lm-perfil',perfil);return perfil;
}
async function salvaPerfil(ch){
  const {data,error}=await sb.from('profiles').update(ch).eq('id',user.id).select('nome,funcao,barco,avatar_url,plano,plano_ate,cadastro_ok').maybeSingle();
  if(error)return error;if(data){perfil=data;ls.set('lm-perfil',perfil)}drawBtn();return null;
}
async function entrou(u,aviso){
  user=u;setOK(u);
  try{await carregaPerfil()}catch(e){/* sem rede: segue com o que tem */}
  if(!perfil||!perfil.cadastro_ok){lock('concluir');return}
  unlock();if(aviso)flashMsg(aviso);
}
const inicial=()=>((perfil&&perfil.nome)||(user&&user.email)||'?').trim().charAt(0).toUpperCase();
function avatarHTML(){return perfil&&perfil.avatar_url?`<img src="${esc(perfil.avatar_url)}" alt="">`:esc(inicial())}
function drawBtn(){const b=$('acct-btn');b.innerHTML=avatarHTML();b.setAttribute('aria-label','Minha conta'+(perfil&&perfil.nome?': '+perfil.nome:''))}
function flashMsg(t){try{flash(t)}catch(e){}}

// reduz a foto para 512 px antes de enviar
function reduzFoto(file){return new Promise((ok,no)=>{const img=new Image();const u=URL.createObjectURL(file);
  img.onload=()=>{const s=Math.min(1,512/Math.max(img.width,img.height)),w=Math.round(img.width*s),h=Math.round(img.height*s);
    const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(u);
    c.toBlob(b=>b?ok(b):no(new Error('Não consegui ler a foto.')),'image/jpeg',0.85)};
  img.onerror=()=>{URL.revokeObjectURL(u);no(new Error('Esse arquivo não é uma foto que o celular consiga abrir.'))};img.src=u})}
async function apagaFotos(){const {data}=await sb.storage.from('avatars').list(user.id);if(data&&data.length)await sb.storage.from('avatars').remove(data.map(f=>user.id+'/'+f.name))}
async function trocaFoto(file){
  const blob=await reduzFoto(file);
  const path=user.id+'/foto-'+Date.now()+'.jpg';
  const {data:old}=await sb.storage.from('avatars').list(user.id);
  const {error}=await sb.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});
  if(error)throw error;
  const url=sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  const err=await salvaPerfil({avatar_url:url});if(err)throw err;
  if(old&&old.length)await sb.storage.from('avatars').remove(old.map(f=>user.id+'/'+f.name));
}

/* ---------- Minha conta ---------- */
const dlg=$('conta');
function abreConta(msg){
  const p=perfil||{};const online=navigator.onLine!==false;
  const plano=p.plano&&p.plano!=='gratis'?`${esc(p.plano)}${p.plano_ate?' · até '+new Date(p.plano_ate).toLocaleDateString('pt-BR'):''}`:'Grátis';
  $('conta-in').innerHTML=`<div class="hd"><div><div class="eyebrow">Limamar</div><h2 id="ct-title">Minha conta</h2></div><button type="button" class="ghost x" id="ct-x" aria-label="Fechar">×</button></div>
    ${msg?msgBox(msg.t,msg.c):''}
    ${online?'':msgBox('Sem internet: dá para ver a conta, mas mudanças só com sinal.','info')}
    <div class="me"><div class="avatar" id="ct-av">${avatarHTML()}</div>
      <div style="display:grid;gap:6px;min-width:0"><b style="font-size:1.15rem">${esc(p.nome||'')}</b><span class="email">${esc(user&&user.email||(ls.get('lm-ok')||{}).email||'')}</span>
      <div class="row" style="gap:8px"><button type="button" class="ghost" id="ct-foto" style="flex:0 1 auto;padding:8px 12px">${p.avatar_url?'Trocar foto':'Pôr foto'}</button>${p.avatar_url?'<button type="button" class="linkbtn" id="ct-semfoto" style="flex:0 1 auto">Remover</button>':''}</div>
      <input type="file" id="ct-file" accept="image/*" hidden></div></div>
    <div class="panel"><h3 class="eyebrow" style="margin:0">Dados</h3>
      <form id="ct-dados" novalidate>
        <label class="f">Nome<input type="text" id="ct-nome" maxlength="80" value="${esc(p.nome)}"></label>
        <label class="f">Você é<select id="ct-funcao" class="sel">${FUNCOES.map(f=>`<option ${p.funcao===f?'selected':''}>${f}</option>`).join('')}</select></label>
        <label class="f">Embarcação<input type="text" id="ct-barco" maxlength="80" value="${esc(p.barco)}"></label>
        <button type="submit">Salvar dados</button>
      </form></div>
    <div class="panel plan"><div><div class="eyebrow">Plano</div><b>${plano}</b></div><span class="legend">Planos pagos em breve.</span></div>
    <div class="panel"><h3 class="eyebrow" style="margin:0">Trocar senha</h3>
      <form id="ct-senha" novalidate>
        <label class="f">Nova senha<input type="password" id="ct-p1" autocomplete="new-password" minlength="8"></label>
        <label class="f">Repita a nova senha<input type="password" id="ct-p2" autocomplete="new-password" minlength="8"></label>
        <button type="submit" class="ghost">Trocar senha</button>
      </form></div>
    <button type="button" class="ghost" id="ct-sair">Sair da conta</button>
    <div class="panel" style="border-color:var(--stop)"><h3 class="eyebrow" style="margin:0;color:var(--stop)">Excluir conta</h3>
      <p class="legend" style="margin:0">Apaga sua conta, sua foto e seus dados do Limamar. Não dá para desfazer.</p>
      <button type="button" class="danger" id="ct-excluir">Excluir minha conta</button>
      <div id="ct-exc2" hidden style="display:grid;gap:10px">
        <label class="f">Para confirmar, escreva EXCLUIR<input type="text" id="ct-conf" autocomplete="off" autocapitalize="characters"></label>
        <button type="button" class="danger solid" id="ct-excluir2">Excluir para sempre</button>
      </div></div>
    <span id="ct-msg" aria-live="polite"></span>`;
  const M=(t,c)=>{$('ct-msg').innerHTML=msgBox(t,c);$('ct-msg').scrollIntoView({block:'nearest'})};
  $('ct-x').onclick=()=>dlg.close();
  $('ct-foto').onclick=()=>$('ct-file').click();
  $('ct-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;$('ct-foto').disabled=true;$('ct-foto').textContent='Enviando…';
    try{await trocaFoto(f);abreConta({t:'Foto atualizada.',c:'ok'})}catch(err){M(traduz(err));$('ct-foto').disabled=false;$('ct-foto').textContent='Trocar foto'}};
  if($('ct-semfoto'))$('ct-semfoto').onclick=async()=>{try{await apagaFotos();const er=await salvaPerfil({avatar_url:null});if(er)throw er;abreConta({t:'Foto removida.',c:'ok'})}catch(err){M(traduz(err))}};
  $('ct-dados').onsubmit=async e=>{e.preventDefault();const nome=$('ct-nome').value.trim();if(nome.length<2)return M('Escreva seu nome.');
    busy(e.target,true,'Salvando…');const er=await salvaPerfil({nome,funcao:$('ct-funcao').value,barco:$('ct-barco').value.trim()||null});busy(e.target,false);
    er?M(traduz(er)):abreConta({t:'Dados salvos.',c:'ok'})};
  $('ct-senha').onsubmit=async e=>{e.preventDefault();const p1=$('ct-p1').value,p2=$('ct-p2').value;
    if(!senhaOk(p1))return M(traduz('weak'));if(p1!==p2)return M('As duas senhas não são iguais.');
    busy(e.target,true,'Trocando…');const {error}=await sb.auth.updateUser({password:p1});busy(e.target,false);
    error?M(traduz(error)):abreConta({t:'Senha trocada.',c:'ok'})};
  $('ct-sair').onclick=async()=>{await sb.auth.signOut().catch(()=>{});clearLocal();dlg.close();lock('entrar',{t:'Você saiu da conta.',c:'info'})};
  $('ct-excluir').onclick=()=>{$('ct-exc2').hidden=false;$('ct-excluir').hidden=true;$('ct-conf').focus()};
  $('ct-excluir2').onclick=async()=>{
    if($('ct-conf').value.trim().toUpperCase()!=='EXCLUIR')return M('Escreva EXCLUIR para confirmar.');
    const b=$('ct-excluir2');b.disabled=true;b.textContent='Excluindo…';
    try{await apagaFotos().catch(()=>{});const {error}=await sb.rpc('excluir_minha_conta');if(error)throw error;
      await sb.auth.signOut({scope:'local'}).catch(()=>{});clearLocal();dlg.close();lock('entrar',{t:'Sua conta foi excluída.',c:'info'})}
    catch(err){b.disabled=false;b.textContent='Excluir para sempre';M(traduz(err))}};
  if(!dlg.open)dlg.showModal?dlg.showModal():dlg.setAttribute('open','');
}
$('acct-btn').onclick=()=>abreConta();
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});

/* ---------- início ---------- */
sb.auth.onAuthStateChange((ev,session)=>{
  if(ev==='PASSWORD_RECOVERY'){user=session&&session.user;lock('nova');}
  else if(ev==='SIGNED_OUT'&&ls.get('lm-ok')&&navigator.onLine!==false){clearLocal();lock('entrar',{t:'Sua sessão terminou. Entre de novo.',c:'info'})}
});
(async()=>{
  const hp=new URLSearchParams(location.hash.slice(1)), qp=new URLSearchParams(location.search);
  const tipo=hp.get('type'), erro=hp.get('error_description')||qp.get('error_description');
  let session=null,falhouRede=false;
  try{const r=await sb.auth.getSession();session=r.data.session;if(r.error)falhouRede=true}catch(e){falhouRede=true}
  if(location.hash&&/access_token|error/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);
  if(erro){lock('entrar',{t:traduz(erro.replace(/\+/g,' '))});return}
  if(session){
    user=session.user;
    if(tipo==='recovery'){lock('nova');return}
    await entrou(user,tipo==='signup'?'E-mail confirmado. Bem-vindo!':null);
    return;
  }
  // sem sessão: no mar, sem sinal, deixa entrar quem já entrou neste celular
  const ok=ls.get('lm-ok');
  if(ok&&(navigator.onLine===false||falhouRede)){unlock();return}
  clearLocal();lock('entrar');
})();
})();
