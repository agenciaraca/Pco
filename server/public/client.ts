/**
 * JS do site público, servido como asset same-origin (/_pub/site.js) para
 * respeitar a CSP `script-src 'self'` (sem inline). Minúsculo, sem dependências.
 * Progressive enhancement: a página funciona sem ele (SSR completo).
 *
 * Responsabilidades: toggle de tema, menu mobile, badge do carrinho
 * (localStorage `pco_cart`), accordions de FAQ, contadores ao entrar na viewport.
 */
export const PUBLIC_JS = `
(function(){
  'use strict';
  var CART_KEY='pco_cart';
  // ---- tema (persistente; auto por SO quando não definido) ----
  try{var t=localStorage.getItem('pco_theme');if(t){document.documentElement.dataset.theme=t;}}catch(e){}
  function toggleTheme(){
    var cur=document.documentElement.dataset.theme;
    if(!cur){cur=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
    var next=cur==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;
    try{localStorage.setItem('pco_theme',next);}catch(e){}
  }
  // ---- carrinho ----
  function readCart(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]');}catch(e){return[];}}
  function cartCount(){return readCart().reduce(function(n,i){return n+(i.qty||1);},0);}
  function paintCart(){
    var n=cartCount();
    document.querySelectorAll('.cart-badge').forEach(function(b){b.setAttribute('data-count',String(n));b.textContent=String(n);});
  }
  window.pcoCart={
    add:function(item){
      var c=readCart();var f=c.find(function(x){return x.slug===item.slug;});
      // Curso nao se compra em dobro: comprar duas vezes nao da dois acessos, e
      // o servidor colapsa duplicata ao montar o pedido. Entao adicionar de novo
      // nao incrementa nada — so avisa que ja esta la.
      if(f){toast('Este curso ja esta no carrinho');return;}
      c.push({slug:item.slug,title:item.title,price:item.price,href:item.href,qty:1});
      try{localStorage.setItem(CART_KEY,JSON.stringify(c));}catch(e){}
      paintCart();window.dispatchEvent(new CustomEvent('pco-cart-change'));toast('Adicionado ao carrinho');
    },
    read:readCart,count:cartCount
  };
  function toast(msg){
    var el=document.createElement('div');el.textContent=msg;el.setAttribute('role','status');
    el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--accent);color:var(--on-accent);padding:12px 20px;border-radius:999px;font-weight:700;font-size:14px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:300;opacity:0;transition:opacity .2s';
    document.body.appendChild(el);requestAnimationFrame(function(){el.style.opacity='1';});
    setTimeout(function(){el.style.opacity='0';setTimeout(function(){el.remove();},250);},2600);
  }
  // ---- delegação de cliques ----
  document.addEventListener('click',function(e){
    var tt=e.target.closest('[data-theme-toggle]');if(tt){e.preventDefault();toggleTheme();return;}
    var mt=e.target.closest('[data-menu-toggle]');if(mt){e.preventDefault();var nav=document.getElementById('site-nav');if(nav){nav.classList.toggle('open');mt.setAttribute('aria-expanded',nav.classList.contains('open')?'true':'false');}return;}
    var add=e.target.closest('[data-add-cart]');if(add){e.preventDefault();window.pcoCart.add({slug:add.getAttribute('data-slug'),title:add.getAttribute('data-title'),price:Number(add.getAttribute('data-price')||0),href:'/formacao/'+add.getAttribute('data-slug')});return;}
    var acc=e.target.closest('[data-accordion]');if(acc){var panel=acc.nextElementSibling;var open=acc.getAttribute('aria-expanded')==='true';acc.setAttribute('aria-expanded',open?'false':'true');if(panel){panel.style.maxHeight=open?'0px':panel.scrollHeight+'px';}return;}
  });
  // ---- origem da visita (primeiro toque) ----
  //
  // Guardado no PRIMEIRO acesso e nunca sobrescrito: quem chega por um anúncio
  // e volta dias depois digitando o endereço converteu pelo anúncio, não pelo
  // acesso direto. Sobrescrever daria todo o crédito ao último clique, que é
  // justamente o erro que faz campanha boa parecer ruim.
  //
  // Não é cookie e não identifica ninguém: é utm/gclid da própria URL, no
  // localStorage deste navegador, e só viaja junto de uma compra.
  var ORIGEM_KEY = 'pco_origem';
  function capturaOrigem() {
    try {
      if (localStorage.getItem(ORIGEM_KEY)) return;
      var p = new URLSearchParams(location.search);
      var campos = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','gclid','fbclid'];
      var o = {};
      var achou = false;
      for (var i = 0; i < campos.length; i++) {
        var v = p.get(campos[i]);
        if (v) { o[campos[i]] = String(v).slice(0, 300); achou = true; }
      }
      var ref = document.referrer || '';
      if (ref && ref.indexOf(location.host) === -1) { o.referrer = ref.slice(0, 300); achou = true; }
      if (achou) localStorage.setItem(ORIGEM_KEY, JSON.stringify(o));
    } catch (e) {}
  }
  function leOrigem() {
    try { return JSON.parse(localStorage.getItem(ORIGEM_KEY) || 'null') || undefined; } catch (e) { return undefined; }
  }
  capturaOrigem();

  // ---- checkout público (form -> API -> redirect pro gateway) ----
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-checkout]');
    if (!f) return;
    e.preventDefault();
    var btn = f.querySelector('[data-checkout-submit]');
    var errEl = f.querySelector('[data-checkout-error]');
    if (errEl) errEl.style.display = 'none';
    var g = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? el.value : ''; };
    var cons = f.querySelector('[name="consent"]');
    // O meio de pagamento decide QUAL gateway cobra — ver
    // server/payments/roteamento.ts. Antes disto o método não era um dado
    // nosso: cada gateway decidia sozinho, e o Asaas cobrava Pix por omissão.
    var metodoEl = f.querySelector('input[name="metodo"]:checked');
    var metodo = metodoEl ? metodoEl.value : null;
    var payload = {
      name: g('name'), email: g('email'), whatsapp: g('whatsapp'),
      document: g('document'), consent: !!(cons && cons.checked),
      metodo: metodo,
      // De onde a pessoa veio. Não muda preço nem acesso — o servidor só grava.
      origem: leOrigem()
    };
    // Boleto sem CPF faz o gateway recusar o pedido INTEIRO — e a pessoa perde
    // junto o cartão e o Pix na mesma recusa. Barrar aqui devolve um erro que
    // diz o que fazer, em vez de "falha no pagamento".
    if (metodo === 'boleto' && !payload.document) {
      if (errEl) { errEl.textContent = 'Para pagar no boleto, informe o CPF.'; errEl.style.display = 'block'; }
      var cpfEl = f.querySelector('[name="document"]');
      if (cpfEl && cpfEl.focus) cpfEl.focus();
      return;
    }
    // Checkout de carrinho manda a lista; o de um curso só manda o slug.
    // O PRECO nao vai em nenhum dos dois: quem soma e o servidor, a partir dos
    // produtos ativos. O carrinho vive no localStorage, entao o que ele diz
    // sobre valor e palpite.
    if (f.hasAttribute('data-checkout-carrinho')) {
      payload.courseSlugs = readCart().map(function (i) { return i.slug; });
    } else {
      payload.courseSlug = f.getAttribute('data-slug');
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Processando…'; }
    fetch('/api/public/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.checkoutUrl) { window.location.href = res.j.checkoutUrl; return; }
        var msg = (res.j && res.j.error && res.j.error.message) || 'Não foi possível iniciar o pagamento. Tente novamente.';
        if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Ir para o pagamento'; }
      })
      .catch(function () {
        if (errEl) { errEl.textContent = 'Erro de conexão. Tente novamente.'; errEl.style.display = 'block'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Ir para o pagamento'; }
      });
  });

  // ---- carrinho: lista, remover, total ----
  // A pagina do carrinho e servida vazia e preenchida aqui, porque o carrinho
  // mora no localStorage deste navegador — nao no servidor. Sem JS a pagina
  // mostra o aviso que ja veio no HTML.
  function brl(cents){
    try{return (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
    catch(e){return 'R$ '+(cents/100).toFixed(2);}
  }
  function pintarCarrinho(){
    var lista=document.querySelector('[data-carrinho-lista]');
    var vazio=document.querySelector('[data-carrinho-vazio]');
    var corpo=document.querySelector('[data-carrinho-corpo]');
    if(!lista&&!vazio) return;
    var itens=readCart();
    if(!itens.length){
      if(vazio) vazio.style.display='';
      if(corpo) corpo.style.display='none';
      return;
    }
    if(vazio) vazio.style.display='none';
    if(corpo) corpo.style.display='';
    if(!lista) return;
    var total=0,temSemPreco=false;
    lista.innerHTML='';
    itens.forEach(function(i){
      var cents=Math.round(Number(i.price||0)*100);
      if(!cents) temSemPreco=true;
      total+=cents;
      var href=i.href||('/formacao/'+i.slug);

      var cartao=document.createElement('div');
      cartao.className='carrinho-item';

      var capa=document.createElement('a');
      capa.className='carrinho-capa';
      capa.href=href;
      capa.setAttribute('aria-hidden','true');
      capa.setAttribute('tabindex','-1');

      var meio=document.createElement('div');
      meio.className='meio';
      var titulo=document.createElement('a');
      titulo.className='titulo';titulo.href=href;titulo.textContent=i.title||i.slug;
      var tipo=document.createElement('div');
      tipo.className='tipo';tipo.textContent='Formação profissional · online';
      var tirar=document.createElement('button');
      tirar.type='button';tirar.className='tirar';
      tirar.setAttribute('data-carrinho-remover',i.slug);
      tirar.setAttribute('aria-label','Remover '+(i.title||i.slug)+' do carrinho');
      tirar.textContent='Remover';
      meio.appendChild(titulo);meio.appendChild(tipo);meio.appendChild(tirar);

      var valor=document.createElement('div');
      valor.className='valor';
      valor.textContent=cents?brl(cents):'—';

      cartao.appendChild(capa);cartao.appendChild(meio);cartao.appendChild(valor);
      lista.appendChild(cartao);
    });
    // Com item sem preco o total mentiria, entao ele sai de cena e quem fecha a
    // conta e o checkout, que soma no servidor.
    var texto=temSemPreco?'—':brl(total);
    document.querySelectorAll('[data-carrinho-total],[data-carrinho-subtotal]').forEach(function(el){
      el.textContent=texto;
    });
  }
  function removerDoCarrinho(slug){
    var c=readCart().filter(function(i){return i.slug!==slug;});
    try{localStorage.setItem(CART_KEY,JSON.stringify(c));}catch(e){}
    paintCart();pintarCarrinho();
    window.dispatchEvent(new CustomEvent('pco-cart-change'));
  }
  document.addEventListener('click',function(e){
    var r=e.target.closest('[data-carrinho-remover]');
    if(r){e.preventDefault();removerDoCarrinho(r.getAttribute('data-carrinho-remover'));}
  });
  window.addEventListener('pco-cart-change',pintarCarrinho);
  pintarCarrinho();

  // ---- contadores ao entrar na viewport ----
  // Era IntersectionObserver com threshold .4 e falhava calado: a barra de
  // números ocupa quase a altura da tela, então em telas baixas 40% dela nunca
  // fica visível de uma vez e o disparo não acontecia — o número ficava
  // congelado em 0 para sempre, o que é pior do que não animar.
  // Agora a decisão é por posição (getBoundingClientRect), com um intervalo de
  // meio segundo como rede para o caso de a página carregar já rolada.
  var counters=document.querySelectorAll('[data-count-to]');
  if(counters.length){
    var pendentes=[].slice.call(counters);
    var timer=null;
    function anima(el){
      var to=Number(el.getAttribute('data-count-to')||0),t0=null,dur=1100;
      // Ano não leva separador de milhar: "2.018" não é um ano, é um número.
      // O separador vale para quantidade ("1.000+ alunos"), não para data.
      var cru=el.hasAttribute('data-count-plain');
      function step(ts){if(!t0)t0=ts;var p=Math.min((ts-t0)/dur,1);var e=1-Math.pow(1-p,3);
        var v=Math.round(to*e);
        el.textContent=cru?String(v):v.toLocaleString('pt-BR');
        if(p<1)requestAnimationFrame(step);}
      requestAnimationFrame(step);
    }
    function varre(){
      for(var i=pendentes.length-1;i>=0;i--){
        var el=pendentes[i];
        var r=el.getBoundingClientRect();
        // 1.1x a altura da janela: começa um pouco antes de entrar, para que a
        // animação não comece exatamente quando o olho chega.
        if(r.top<window.innerHeight*1.1&&r.bottom>0){pendentes.splice(i,1);anima(el);}
      }
      if(!pendentes.length){
        window.removeEventListener('scroll',varre);
        window.removeEventListener('resize',varre);
        if(timer){clearInterval(timer);timer=null;}
      }
    }
    window.addEventListener('scroll',varre,{passive:true});
    window.addEventListener('resize',varre,{passive:true});
    timer=setInterval(varre,500);
    varre();
  }
  // ---- consentimento de cookies ----
  // A barra só existe no HTML quando ha tag de terceiro esperando aceite; aqui
  // ela aparece so para quem ainda nao escolheu. Aceitar dispara o evento que
  // acorda /_pub/tags.js sem recarregar a pagina; recusar guarda o "nao" para
  // que a barra nao volte a cada clique.
  var CONSENT_KEY='pco_consent';
  var banner=document.querySelector('[data-consent]');
  if(banner){
    var escolha=null;
    try{escolha=localStorage.getItem(CONSENT_KEY);}catch(e){}
    if(!escolha){banner.hidden=false;}
    function responde(valor){
      try{localStorage.setItem(CONSENT_KEY,valor);}catch(e){}
      banner.hidden=true;
      if(valor==='sim'){document.dispatchEvent(new CustomEvent('pco:consentimento'));}
    }
    var sim=banner.querySelector('[data-consent-sim]');
    var nao=banner.querySelector('[data-consent-nao]');
    if(sim)sim.addEventListener('click',function(){responde('sim');});
    if(nao)nao.addEventListener('click',function(){responde('nao');});
  }
  // sync entre abas
  window.addEventListener('storage',function(e){if(e.key===CART_KEY)paintCart();});
  paintCart();
})();
`.trim();
