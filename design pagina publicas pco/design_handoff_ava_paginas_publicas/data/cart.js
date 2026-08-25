// ============================================================
// PCO — carrinho persistente (localStorage) + eventos
// API pura, usável por qualquer página. Chave: 'pco_cart'.
// Item: { slug, title, price, qty }
// ============================================================

const KEY = 'pco_cart';
const EVT = 'pco-cart-change';

export function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch (e) { return []; }
}

function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(EVT, { detail: items }));
}

export function addToCart(item) {
  const items = getCart();
  const existing = items.find(i => i.slug === item.slug);
  if (existing) { existing.qty += (item.qty || 1); }
  else { items.push({ slug: item.slug, title: item.title, price: item.price, qty: item.qty || 1 }); }
  save(items);
  return items;
}

export function removeItem(slug) {
  save(getCart().filter(i => i.slug !== slug));
}

export function setQty(slug, qty) {
  const items = getCart();
  const it = items.find(i => i.slug === slug);
  if (it) { it.qty = Math.max(1, qty); save(items); }
}

export function clearCart() { save([]); }

export function cartCount() { return getCart().reduce((n, i) => n + i.qty, 0); }
export function cartTotal() { return getCart().reduce((s, i) => s + i.price * i.qty, 0); }

// Assina mudanças no carrinho (mesma aba via CustomEvent, outras abas via storage).
export function subscribe(cb) {
  const onEvt = () => cb(getCart());
  const onStorage = (e) => { if (e.key === KEY) cb(getCart()); };
  window.addEventListener(EVT, onEvt);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVT, onEvt); window.removeEventListener('storage', onStorage); };
}
