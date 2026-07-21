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
      if(f){f.qty=(f.qty||1)+1;}else{c.push({slug:item.slug,title:item.title,price:item.price,qty:1});}
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
    var add=e.target.closest('[data-add-cart]');if(add){e.preventDefault();window.pcoCart.add({slug:add.getAttribute('data-slug'),title:add.getAttribute('data-title'),price:Number(add.getAttribute('data-price')||0)});return;}
    var acc=e.target.closest('[data-accordion]');if(acc){var panel=acc.nextElementSibling;var open=acc.getAttribute('aria-expanded')==='true';acc.setAttribute('aria-expanded',open?'false':'true');if(panel){panel.style.maxHeight=open?'0px':panel.scrollHeight+'px';}return;}
  });
  // ---- contadores ao entrar na viewport ----
  var counters=document.querySelectorAll('[data-count-to]');
  if(counters.length&&'IntersectionObserver'in window){
    var io=new IntersectionObserver(function(ents){ents.forEach(function(en){
      if(!en.isIntersecting)return;io.unobserve(en.target);
      var el=en.target,to=Number(el.getAttribute('data-count-to')||0),t0=null,dur=1100;
      function step(ts){if(!t0)t0=ts;var p=Math.min((ts-t0)/dur,1);var e=1-Math.pow(1-p,3);
        el.textContent=Math.round(to*e).toLocaleString('pt-BR');if(p<1)requestAnimationFrame(step);}
      requestAnimationFrame(step);
    });},{threshold:.4});
    counters.forEach(function(c){io.observe(c);});
  }
  // sync entre abas
  window.addEventListener('storage',function(e){if(e.key===CART_KEY)paintCart();});
  paintCart();
})();
`.trim();
