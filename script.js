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

  // Username
  document.getElementById('dc-username').textContent = discord_user?.global_name || discord_user?.username || 'Arthuxx';

  // Banner
  if (discord_user?.banner) {
    const bannerEl = document.getElementById('dc-banner');
    const ext = discord_user.banner.startsWith('a_') ? 'gif' : 'png';
    bannerEl.style.backgroundImage = `url(https://cdn.discordapp.com/banners/${discord_user.id}/${discord_user.banner}.${ext}?size=480)`;
    bannerEl.style.backgroundSize = 'cover';
    bannerEl.style.backgroundPosition = 'center';
    bannerEl.classList.add('has-bg');
    bannerEl.innerHTML = '';
  }

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
  if (game && !listening_to_spotify) {
    activityEl.style.display = 'block';
    document.getElementById('dc-activity-inner').innerHTML = `
      <p class="dc-game-name">${game.name}</p>
      ${game.details ? `<p class="dc-game-details">${game.details}</p>` : ''}
      ${game.state ? `<p class="dc-game-state">${game.state}</p>` : ''}
    `;
  } else {
    activityEl.style.display = 'none';
  }
}

function connectLanyard() {
  const ws = new WebSocket('wss://api.lanyard.rest/socket');
  let heartbeat;

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.op === 1) {
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_ID } }));
      heartbeat = setInterval(() => ws.send(JSON.stringify({ op: 3 })), msg.d.heartbeat_interval);
    }

    if (msg.op === 0) {
      const payload = msg.t === 'INIT_STATE' ? msg.d[DISCORD_ID] : msg.d;
      if (payload) updateCard(payload);
    }
  };

  ws.onclose = () => {
    clearInterval(heartbeat);
    setTimeout(connectLanyard, 5000);
  };

  ws.onerror = () => ws.close();
}

if (document.getElementById('dc-card')) connectLanyard();
