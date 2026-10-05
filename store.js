// ===== CONFIG =====
// Clé publique Tebex (panel Tebex → Integrations → Headless API → Public Token).
// Laisser vide = mode maquette avec des données d'exemple.
const TEBEX_TOKEN = '14srr-bd7309d4ce3242cdb9c94aaa80be718dde2e5ffa';

const API = 'https://headless.tebex.io/api';
const BASKET_KEY = 'luma_basket_ident';
const PAGE_URL = location.origin + location.pathname;

// Vidéos de démo : prises automatiquement dans les médias du package Tebex.
// Secours si besoin : nom du package en minuscules → ID de la vidéo YouTube
const VIDEOS = {
  singerparty: '4Vc99fvAKmg',
};

// Icône micro Luma (remplace l'emoji 🎤 dans les descriptions)
const MIC_ICON = `<svg class="luma-icon" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="lumaMic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8a8a8a"/></linearGradient></defs><rect x="8.5" y="2" width="7" height="12" rx="3.5" fill="url(#lumaMic)"/><path d="M9.5 6h2M9.5 8.5h2M9.5 11h2" stroke="#080808" stroke-width="1.1" stroke-linecap="round"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0" fill="none" stroke="url(#lumaMic)" stroke-width="1.8" stroke-linecap="round"/><path d="M12 17.5V21M8.5 21.5h7" stroke="url(#lumaMic)" stroke-width="1.8" stroke-linecap="round"/><path d="M19.5 3.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5z" fill="#fff"/></svg>`;

// Données d'exemple affichées tant que TEBEX_TOKEN est vide
const MOCK_CATEGORIES = [{
  id: 1, name: 'Mini-jeux',
  packages: [{
    id: 101, name: 'SingerParty',
    image: 'https://dunb17ur4ymx4.cloudfront.net/packages/images/2d2296972fb3aec1dafa461037ab8df901534288.jpg',
    base_price: 29.99, total_price: 29.99, discount: 0, currency: 'EUR',
    category: { name: 'Mini-jeux' },
    description: `
      <p><strong>🎤 SINGER PARTY</strong> — le jeu d'imitation vocale qui met l'ambiance sur ton serveur.</p>
      <h3>Fonctionnalités</h3>
      <ul>
        <li>Scène de performance avec caméras dynamiques</li>
        <li>Analyse de la voix et système de score</li>
        <li>Modes multijoueurs</li>
        <li>Plusieurs parties en simultané</li>
        <li>Interface stylisée</li>
        <li>Protections anti-triche</li>
      </ul>
      <h3>Prérequis</h3>
      <ul><li>OneSync</li><li>ox_lib</li></ul>
      <p>Protégé par Asset Escrow, fichier de configuration modifiable. Documentation d'installation complète incluse.</p>`
  }]
}];

// ===== ÉTAT =====
const state = {
  categories: [],
  packages: [],
  activeCat: 'all',
  search: '',
  basket: null,
  current: null,
};

const $ = (id) => document.getElementById(id);
const isMock = !TEBEX_TOKEN;

// ===== UTILS =====
function formatPrice(value, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value);
}

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return (d.textContent || '').replace(/🎤️?/g, '').replace(/\s+/g, ' ').trim();
}

function withIcons(html) {
  return (html || '').replace(/🎤️?/g, MIC_ICON);
}

function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function videoOf(p) {
  const media = (p.media || []).find((m) => m.type === 'video' && youtubeId(m.url));
  if (media) return youtubeId(media.url);
  return VIDEOS[String(p.name).toLowerCase().replace(/\s+/g, '')];
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || json.title || `Erreur ${res.status}`);
  return json.data ?? json;
}

// ===== CATALOGUE =====
async function loadCatalogue() {
  try {
    state.categories = isMock
      ? MOCK_CATEGORIES
      : await api(`/accounts/${TEBEX_TOKEN}/categories?includePackages=1`);
  } catch (e) {
    $('productGrid').innerHTML = '';
    $('storeEmpty').textContent = 'Impossible de charger la boutique pour le moment. Réessaie dans quelques instants.';
    $('storeEmpty').hidden = false;
    return;
  }
  state.packages = state.categories.flatMap((c) =>
    (c.packages || []).map((p) => ({ ...p, _cat: c.name, _catId: c.id }))
  );
  renderPills();
  renderGrid();
}

function renderPills() {
  const cats = state.categories.filter((c) => (c.packages || []).length);
  const pills = [{ id: 'all', name: 'Tout' }, ...cats];
  $('catPills').innerHTML = pills
    .map((c) => `<button class="cat-pill${String(c.id) === String(state.activeCat) ? ' active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>`)
    .join('');
}

function priceHtml(p) {
  const old = p.discount > 0 ? `<s>${formatPrice(p.base_price, p.currency)}</s>` : '';
  return old + formatPrice(p.total_price, p.currency);
}

function renderGrid() {
  const q = state.search.toLowerCase();
  const list = state.packages.filter((p) =>
    (state.activeCat === 'all' || String(p._catId) === String(state.activeCat)) &&
    (!q || p.name.toLowerCase().includes(q) || stripHtml(p.description).toLowerCase().includes(q))
  );

  const cards = list.map((p) => `
    <article class="product-card" data-id="${p.id}">
      <div class="product-media">
        ${p.discount > 0 ? '<span class="product-badge sale">Promo</span>' : ''}
        ${videoOf(p) ? '<span class="product-badge video"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8z"/></svg> Vidéo</span>' : ''}
        ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy" />` : ''}
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(p._cat)}</span>
        <h3 class="product-name">${escapeHtml(p.name)}</h3>
        <p class="product-excerpt">${escapeHtml(stripHtml(p.description))}</p>
        <div class="product-foot">
          <span class="product-price">${priceHtml(p)}</span>
          <button class="btn btn-primary" data-buy="${p.id}">Acheter</button>
        </div>
      </div>
    </article>`);

  if (state.activeCat === 'all' && !q) {
    cards.push(`
      <article class="product-card soon">
        <div class="soon-inner">
          <strong>Prochainement</strong>
          <span>De nouveaux scripts arrivent. Suis les sorties sur notre Discord.</span>
        </div>
      </article>`);
  }

  $('productGrid').innerHTML = cards.join('');
  $('storeEmpty').hidden = list.length > 0 || state.packages.length === 0;
}

// ===== MODALE PRODUIT =====
function openProduct(id) {
  const p = state.packages.find((x) => String(x.id) === String(id));
  if (!p) return;
  state.current = p;
  const vid = videoOf(p);
  $('modalMedia').innerHTML =
    (p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />` : '') +
    (vid ? `<button class="play-btn" data-play="${vid}" aria-label="Voir la vidéo"><span><svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5l13 7.5-13 7.5z"/></svg></span>Voir la démo</button>` : '');
  $('modalCat').textContent = p._cat;
  $('modalTitle').textContent = p.name;
  // description rédigée par Luma Studio dans le panel Tebex
  $('modalDesc').innerHTML = withIcons(p.description);
  $('modalPrice').innerHTML = priceHtml(p);
  $('productModal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function playVideo(id) {
  $('modalMedia').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Vidéo de démo"></iframe>`;
}

function closeAll() {
  $('modalMedia').innerHTML = '';
  $('productModal').hidden = true;
  $('basketDrawer').hidden = true;
  document.body.style.overflow = '';
}

// ===== PANIER =====
async function getBasket(create = false) {
  const ident = localStorage.getItem(BASKET_KEY);
  if (ident) {
    try {
      const b = await api(`/accounts/${TEBEX_TOKEN}/baskets/${ident}`);
      if (!b.complete) return b;
    } catch (e) { /* panier expiré */ }
    localStorage.removeItem(BASKET_KEY);
  }
  if (!create) return null;
  const b = await api(`/accounts/${TEBEX_TOKEN}/baskets`, {
    method: 'POST',
    body: JSON.stringify({
      complete_url: PAGE_URL + '?paid=1',
      cancel_url: PAGE_URL,
      complete_auto_redirect: true,
    }),
  });
  localStorage.setItem(BASKET_KEY, b.ident);
  return b;
}

async function addToBasket(packageId) {
  if (isMock) {
    toast('Mode maquette : le panier sera actif une fois la boutique branchée');
    return;
  }
  try {
    let basket = await getBasket(true);

    // Connexion Cfx.re obligatoire avant d'ajouter un script
    if (!basket.username) {
      const returnUrl = `${PAGE_URL}?add=${encodeURIComponent(packageId)}`;
      const providers = (await api(`/accounts/${TEBEX_TOKEN}/baskets/${basket.ident}/auth?returnUrl=${encodeURIComponent(returnUrl)}`))
        .flat()
        .filter((x) => x && x.url);
      if (providers.length) {
        toast('Connexion à ton compte Cfx.re…');
        location.href = providers[0].url;
        return;
      }
    }

    basket = await api(`/baskets/${basket.ident}/packages`, {
      method: 'POST',
      body: JSON.stringify({ package_id: Number(packageId), quantity: 1 }),
    });
    state.basket = basket;
    renderBasket();
    closeAll();
    openBasket();
    toast('Ajouté au panier');
  } catch (e) {
    toast(e.message || "Impossible d'ajouter au panier");
  }
}

async function removeFromBasket(packageId) {
  try {
    state.basket = await api(`/baskets/${state.basket.ident}/packages/remove`, {
      method: 'POST',
      body: JSON.stringify({ package_id: Number(packageId) }),
    });
    renderBasket();
  } catch (e) {
    toast(e.message || 'Erreur');
  }
}

function renderBasket() {
  const b = state.basket;
  const items = b?.packages || [];
  const count = items.reduce((n, p) => n + (p.in_basket?.quantity || 1), 0);

  $('basketCount').textContent = count;
  $('basketCount').hidden = count === 0;

  $('drawerUser').hidden = !b?.username;
  if (b?.username) $('drawerUser').innerHTML = `Connecté en tant que <strong>${escapeHtml(b.username)}</strong>`;

  $('drawerItems').innerHTML = items.length
    ? items.map((p) => {
        const full = state.packages.find((x) => String(x.id) === String(p.id));
        const img = p.image || full?.image;
        const price = p.in_basket?.price ?? full?.total_price ?? 0;
        return `
          <div class="drawer-item">
            ${img ? `<img src="${escapeHtml(img)}" alt="" />` : ''}
            <div class="drawer-item-info">
              <strong>${escapeHtml(p.name)}</strong>
              <span>${formatPrice(price, b.currency)}</span>
            </div>
            <button class="drawer-remove" data-remove="${p.id}" aria-label="Retirer">&times;</button>
          </div>`;
      }).join('')
    : '<p class="drawer-empty">Ton panier est vide.</p>';

  $('drawerTotal').textContent = formatPrice(b?.total_price || 0, b?.currency || 'EUR');
  $('checkoutBtn').disabled = items.length === 0;
}

function openBasket() {
  if (isMock) renderBasket();
  $('basketDrawer').hidden = false;
  document.body.style.overflow = 'hidden';
}

function checkout() {
  const b = state.basket;
  if (!b) return;
  if (window.Tebex?.checkout) {
    Tebex.checkout.init({
      ident: b.ident,
      theme: 'dark',
      colors: [
        { name: 'primary', color: '#ffffff' },
        { name: 'secondary', color: '#111111' },
      ],
    });
    Tebex.checkout.on('payment:complete', onPaid);
    closeAll();
    Tebex.checkout.launch();
  } else if (b.links?.checkout) {
    location.href = b.links.checkout;
  }
}

function onPaid() {
  localStorage.removeItem(BASKET_KEY);
  state.basket = null;
  renderBasket();
  toast('Merci ! Ton script arrive sur portal.cfx.re 🎉');
}

// ===== ÉVÉNEMENTS =====
document.addEventListener('click', (e) => {
  const buy = e.target.closest('[data-buy]');
  if (buy) { e.stopPropagation(); addToBasket(buy.dataset.buy); return; }

  const play = e.target.closest('[data-play]');
  if (play) { playVideo(play.dataset.play); return; }

  const remove = e.target.closest('[data-remove]');
  if (remove) { removeFromBasket(remove.dataset.remove); return; }

  const pill = e.target.closest('[data-cat]');
  if (pill) { state.activeCat = pill.dataset.cat; renderPills(); renderGrid(); return; }

  const card = e.target.closest('.product-card[data-id]');
  if (card) { openProduct(card.dataset.id); return; }

  if (e.target.closest('[data-close]')) closeAll();
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

$('modalBuy').addEventListener('click', () => state.current && addToBasket(state.current.id));
$('basketBtn').addEventListener('click', openBasket);
$('checkoutBtn').addEventListener('click', checkout);
$('searchInput').addEventListener('input', (e) => { state.search = e.target.value.trim(); renderGrid(); });

// halo qui suit la souris sur les cartes
$('productGrid').addEventListener('mousemove', (e) => {
  const card = e.target.closest('.product-card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
});

window.addEventListener('scroll', () => {
  $('nav').classList.toggle('scrolled', window.scrollY > 10);
});

// ===== INIT =====
(async function init() {
  await loadCatalogue();
  if (isMock) return;

  const params = new URLSearchParams(location.search);
  const pendingAdd = params.get('add');
  const paid = params.get('paid');
  if (pendingAdd || paid) history.replaceState(null, '', PAGE_URL);

  if (paid) { onPaid(); return; }

  state.basket = await getBasket(false);
  renderBasket();

  // retour de la connexion Cfx.re : on ajoute le script demandé
  if (pendingAdd && state.basket?.username) addToBasket(pendingAdd);
})();
