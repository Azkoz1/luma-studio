// Nav scroll
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20));

// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const delay = Number(entry.target.dataset.delay || 0);
    setTimeout(() => entry.target.classList.add('visible'), delay);
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

document.querySelectorAll('.service-card, [data-reveal]').forEach(el => observer.observe(el));

// Smooth anchor
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// ===== DISCORD PRESENCE VIA LANYARD =====
const DISCORD_ID = '814881628018966599';

const STATUS_LABELS = { online: 'En ligne', idle: 'Inactif', dnd: 'Ne pas déranger', offline: 'Hors ligne' };

function resolveAssetUrl(str, appId) {
  if (!str) return null;
  if (str.startsWith('mp:')) return 'https://media.discordapp.net/' + str.slice(3);
  if (appId) return `https://cdn.discordapp.com/app-assets/${appId}/${str}.png`;
  return null;
}

function updateCard(data) {
  const loading = document.getElementById('dc-loading');
  const content = document.getElementById('dc-content');
  if (!content) return;

  loading.style.display = 'none';
  content.style.display = 'block';

  const { discord_user, discord_status, activities = [], spotify, listening_to_spotify } = data;

  // Avatar
  const avatarEl = document.getElementById('dc-avatar');
  if (discord_user?.avatar) {
    const ext = discord_user.avatar.startsWith('a_') ? 'gif' : 'png';
    avatarEl.src = `https://cdn.discordapp.com/avatars/${discord_user.id}/${discord_user.avatar}.${ext}?size=128`;
  } else {
    avatarEl.src = `https://cdn.discordapp.com/embed/avatars/${(BigInt(discord_user?.id || 0) >> 22n) % 6n}.png`;
  }

  // Username + handle
  document.getElementById('dc-username').textContent = discord_user?.global_name || discord_user?.username || 'Arthuxx';
  const handleEl = document.getElementById('dc-handle');
  if (discord_user?.username) handleEl.textContent = discord_user.username;

  // Avatar decoration
  const decoEl = document.getElementById('dc-avatar-deco');
  if (discord_user?.avatar_decoration_data?.asset) {
    const asset = discord_user.avatar_decoration_data.asset;
    decoEl.src = `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png`;
    decoEl.style.display = 'block';
  }

  // Guild tag (LUMA)
  const guildEl = document.getElementById('dc-guild-tag');
  if (discord_user?.primary_guild?.tag) {
    const guildId = discord_user.primary_guild.identity_guild_id;
    const badge = discord_user.primary_guild.badge;
    guildEl.style.display = 'inline-flex';
    guildEl.innerHTML = badge
      ? `<img src="https://cdn.discordapp.com/icons/${guildId}/${badge}.png?size=16" alt="" class="dc-guild-icon" /> ${discord_user.primary_guild.tag}`
      : discord_user.primary_guild.tag;
  }

  // Banner — Lanyard ne retourne pas le hash, on utilise l'image statique
  const bannerEl = document.getElementById('dc-banner');
  const staticBanner = 'assets/banner.png';
  const bannerImg = new Image();
  bannerImg.onload = () => {
    bannerEl.style.backgroundImage = `url(${staticBanner})`;
    bannerEl.style.backgroundSize = 'cover';
    bannerEl.style.backgroundPosition = 'center top';
  };
  bannerImg.src = staticBanner;

  // Status dot
  const dot = document.getElementById('dc-status-dot');
  dot.className = `dc-status-dot ${discord_status || 'offline'}`;

  // Status label
  document.getElementById('dc-status-label').textContent = STATUS_LABELS[discord_status] || 'Hors ligne';

  // Custom status
  const customStatus = activities.find(a => a.type === 4);
  const customEl = document.getElementById('dc-custom-status');
  if (customStatus?.state || customStatus?.emoji) {
    customEl.textContent = `${customStatus.emoji?.name || ''} ${customStatus.state || ''}`.trim();
  } else {
    customEl.textContent = '';
  }

  // Spotify
  const spotifyEl = document.getElementById('dc-spotify');
  if (listening_to_spotify && spotify) {
    spotifyEl.style.display = 'block';
    document.getElementById('dc-spotify-inner').innerHTML = `
      <img class="dc-spotify-art" src="${spotify.album_art_url}" alt="cover" />
      <div>
        <p class="dc-spotify-song">${spotify.song}</p>
        <p class="dc-spotify-artist">${spotify.artist.replace(/;/g, ', ')}</p>
        <p class="dc-spotify-album">${spotify.album}</p>
      </div>
    `;
  } else {
    spotifyEl.style.display = 'none';
  }

  // Game activity
  const activityEl = document.getElementById('dc-activity');
  const game = activities.find(a => a.type === 0 || a.type === 1 || a.type === 2);
  if (game) {
    activityEl.style.display = 'block';
    const iconUrl = resolveAssetUrl(game.assets?.large_image, game.application_id);
    document.getElementById('dc-activity-inner').innerHTML = `
      ${iconUrl ? `<img src="${iconUrl}" alt="" class="dc-activity-img" onerror="this.style.display='none'" />` : '<div class="dc-activity-icon">🎮</div>'}
      <div>
        <p class="dc-game-name">${game.name}</p>
        ${game.details ? `<p class="dc-game-details">${game.details}</p>` : ''}
        ${game.state ? `<p class="dc-game-state">${game.state}</p>` : ''}
      </div>
    `;
  } else {
    activityEl.style.display = 'none';
  }
}

async function tryRestAPI() {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
    const json = await res.json();
    if (json.success && json.data) {
      updateCard(json.data);
      return true;
    }
  } catch (_) {}
  return false;
}

function showNotTracked() {
  const loading = document.getElementById('dc-loading');
  if (loading) loading.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
    <p style="color:#666;font-size:12px;text-align:center;max-width:180px">Profil en cours de synchronisation…<br/>Réessai dans quelques secondes.</p>
  `;
}

function connectLanyard() {
  const ws = new WebSocket('wss://api.lanyard.rest/socket');
  let heartbeat;
  let gotData = false;

  const fallbackTimeout = setTimeout(() => {
    if (!gotData) showNotTracked();
  }, 6000);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.op === 1) {
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_ID } }));
      heartbeat = setInterval(() => ws.send(JSON.stringify({ op: 3 })), msg.d.heartbeat_interval);
    }

    if (msg.op === 0) {
      const payload = msg.t === 'INIT_STATE' ? msg.d[DISCORD_ID] : msg.d;
      if (payload) {
        gotData = true;
        clearTimeout(fallbackTimeout);
        updateCard(payload);
      } else if (msg.t === 'INIT_STATE') {
        clearTimeout(fallbackTimeout);
        showNotTracked();
        setTimeout(tryRestAPI, 10000);
      }
    }
  };

  ws.onclose = () => {
    clearInterval(heartbeat);
    setTimeout(connectLanyard, 5000);
  };

  ws.onerror = () => ws.close();
}

if (document.getElementById('dc-card')) {
  tryRestAPI().then(ok => { if (!ok) connectLanyard(); else connectLanyard(); });
}
