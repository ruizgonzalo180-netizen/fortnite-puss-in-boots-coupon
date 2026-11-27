(() => {
  'use strict';
  const media = name => 'lobby-media--' + name;
  let root, art, movie, inputs, costume, status, balance;
  let enterShop, enterLocker;
  let scene = '', currentPlayback = 0, launchNav = false;
  let currentOutfit, currentSidekick;
  const folders = ['Sugeridas', 'Recientes', 'Utilidades', 'Redes sociales', 'Juegos', 'Ocio', 'Creatividad', 'Productividad y finanzas', 'Información y lectura', 'Otras', 'Ocultas'];

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function make() {
    if (root) return;
    root = document.createElement('section');
    root.className = 'fn-lobby';
    root.setAttribute('aria-label', 'Fortnite');
    root.hidden = true;
    root.innerHTML = '<div class="scene-world"><img class="scene-art" alt=""><video class="scene-video" playsinline webkit-playsinline preload="auto" disablepictureinpicture disableremoteplayback></video>' +
      '<div class="lobby-costume"></div><span class="lobby-vbucks" hidden></span></div><div class="portrait-home"><div class="ph-search">⌕ &nbsp;Biblioteca de apps</div><div class="ph-grid"></div></div>' +
      '<div class="portrait-hud" aria-hidden="true"><i class="ph-play"></i><span class="ph-balance"><i></i><b>800</b></span><i class="ph-avatar"></i></div>' +
      '<div class="lobby-status" hidden><span class="lobby-clock"></span><img alt="" src="lobby-media--status.webp"></div><div class="lobby-input"></div>';
    const grid = root.querySelector('.ph-grid');
    folders.forEach((name,index) => {
      const cell = document.createElement('div');
      cell.className = 'ph-folder';
      const panel = document.createElement('div');
      panel.className = 'ph-apps';
      panel.style.backgroundPosition = ((index % 4) * 100 / 3) + '% ' + (Math.floor(index / 4) * 50) + '%';
      const label = document.createElement('span');
      label.textContent = name;
      if (index === 4 || index === 1) {
        const shortcut = document.createElement('button');
        shortcut.type = 'button';
        shortcut.className = index === 4 ? 'ph-fortnite' : 'ph-recent';
        shortcut.setAttribute('aria-label', index === 4 ? 'Open Fortnite' : 'Open recent Fortnite');
        shortcut.addEventListener('click',launch);
        panel.append(shortcut);
      }
      cell.append(panel,label);
      grid.append(cell);
    });
    document.getElementById('stage').append(root);
    art = root.querySelector('.scene-art');
    movie = root.querySelector('video');
    inputs = root.querySelector('.lobby-input');
    costume = root.querySelector('.lobby-costume');
    status = root.querySelector('.lobby-status');
    balance = root.querySelector('.lobby-vbucks');
    movie.controls = false;
    movie.playsInline = true;
    movie.addEventListener('timeupdate', () => {
      if (scene === 'launch' && movie.currentTime >= 11.1 && !launchNav) {
        launchNav = true;
        discoverButtons();
      }
    });
    document.addEventListener('keydown', e => {
      if (root.hidden || e.defaultPrevented || e.key !== 'Escape') return;
      if (scene === 'wheel' || scene === 'dance') { e.preventDefault(); lobby(); }
      else if (scene === 'discover') { e.preventDefault(); lobby(); }
    });
  }

  function button(label, x, y, w, h, handler) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lobby-hit';
    btn.setAttribute('aria-label', label);
    btn.dataset.action = label.toLowerCase().replaceAll(' ','-');
    const captions = {'Play Battle Royale':'Play','Go to lobby':'Go to lobby','Discover Battle Royale':'Play','Back to Discover':'Back','Emote':'Emote','Back':'Back','Close emotes':'Close','Stop emote':'Stop emote'};
    if (captions[label]) btn.dataset.caption = captions[label];
    Object.assign(btn.style, {left:x+'%',top:y+'%',width:w+'%',height:h+'%'});
    btn.addEventListener('click',() => handler());
    inputs.append(btn);
  }

  function reset(next, poster) {
    currentPlayback++;
    movie.onloadeddata = null;
    movie.onended = null;
    movie.onerror = null;
    movie.pause();
    movie.hidden = true;
    root.hidden = false;
    art.src = media(poster);
    scene = next;
    root.dataset.scene = next;
    delete root.dataset.discover;
    inputs.replaceChildren();
    costume.replaceChildren();
    balance.hidden = true;
    status.hidden = true;
  }

  function video(file, loop, onEnd, onUnavailable = onEnd) {
    const playId = currentPlayback;
    const valid = () => playId === currentPlayback && !root.hidden;
    movie.loop = loop;
    movie.muted = false;
    movie.onloadeddata = () => { if (valid()) movie.hidden = false; };
    movie.onended = () => { if (valid() && onEnd) onEnd(); };
    movie.onerror = () => {
      if (!valid()) return;
      movie.hidden = true;
      if (onUnavailable) onUnavailable();
    };
    movie.src = media(file);
    movie.play().catch(() => {
      if (!valid() || movie.error) return;
      movie.muted = true;
      movie.play().catch(() => {
        if (valid()) { movie.hidden = true; if (onUnavailable) onUnavailable(); }
      });
    });
  }

  function readEquip() {
    const equipped = window.ShopState?.equipped || {};
    currentOutfit = equipped.outfit;
    currentSidekick = equipped.sidekick;
  }

  function addPiece(file, css) {
    const img = document.createElement('img');
    img.className = css;
    img.src = media(file);
    img.alt = '';
    costume.append(img);
  }

  function dressed() {
    readEquip();
    if (currentOutfit === 'death') {
      addPiece('platform.webp','platform-patch');
      addPiece('death-idle.webp','lobby-wolf');
    }
    if (currentSidekick === 'puss') addPiece('puss-idle.webp','lobby-cat');
    const amount = window.ShopState?.balance;
    root.querySelector('.ph-balance b').textContent = Number.isFinite(amount) ? amount.toLocaleString('en-US') : '800';
    if (Number.isFinite(amount) && amount !== 800) {
      balance.textContent = amount.toLocaleString('en-US');
      balance.hidden = false;
    }
  }

  function shop() {
    if (!enterShop) return;
    hide();
    enterShop();
  }

  function locker() {
    if (!enterLocker) return;
    hide();
    enterLocker();
  }

  function discoverButtons() {
    root.dataset.discover = 'true';
    const amount = window.ShopState?.balance;
    root.querySelector('.ph-balance b').textContent = Number.isFinite(amount) ? amount.toLocaleString('en-US') : '800';
    inputs.replaceChildren();
    button('Shop',17.55,0,5.2,8.8,shop);
    button('Play Battle Royale',2.2,74.9,8.4,7.7,() => lobby(true));
    button('Go to lobby',73.2,88.6,14,9.5,() => lobby(true));
  }

  function discover() {
    reset('discover','discover.webp');
    discoverButtons();
  }

  function lobbyButtons() {
    button('Shop',22.3,0,5.4,8.6,shop);
    if (enterLocker) button('Locker',17.4,0,4.8,8.6,locker);
    button('Back to Discover',91.1,89.5,8,8.4,discover);
    button('Discover Battle Royale',2,83.6,14.8,6.4,discover);
    button('Emote',82.7,89.5,8.4,8.4,wheel);
  }

  function lobby(arriving = false) {
    reset('lobby','lobby.webp');
    readEquip();
    // The arrival zoom and the equipped frame use different camera positions.
    if (arriving && currentOutfit !== 'death' && currentSidekick !== 'puss') {
      video('lobby.mp4', false, lobby);
    } else {
      video('idle.mp4', true);
    }
    dressed();
    lobbyButtons();
  }

  function wheel() {
    readEquip();
    const alternate = currentOutfit === 'death' || currentSidekick === 'puss';
    if (alternate) {
      lobby();
      scene = 'wheel';
      root.dataset.scene = scene;
      inputs.replaceChildren();
      const overlay = document.createElement('div');
      overlay.className = 'emote-overlay';
      const layer = document.createElement('img');
      layer.alt = '';
      layer.src = media('wheel-controls.webp');
      const title = document.createElement('span');
      title.className = 'emote-title';
      title.textContent = currentOutfit === 'death' ? 'Outfit Preview' : 'Dance Moves';
      overlay.append(layer,title);
      costume.append(overlay);
    } else {
      reset('wheel','wheel.webp');
    }
    button(currentOutfit === 'death' ? 'Outfit Preview' : 'Dance Moves',39,29,22,38,dance);
    button('Close emotes',89.7,89,9.6,9,lobby);
  }

  function dance() {
    readEquip();
    if (currentOutfit === 'death') {
      lobby();
      return;
    }
    reset('dance','lobby.webp');
    video('emote.mp4', false, lobby);
    if (currentSidekick === 'puss') addPiece('puss-idle.webp','lobby-cat');
    button('Shop',22.3,0,5.4,8.6,shop);
    button('Stop emote',72.0,89.5,11,8.4,lobby);
    button('Emote',82.7,89.5,8.4,8.4,wheel);
    button('Back',91.1,89.5,8,8.4,lobby);
  }

  function launch() {
    reset('launch','home.webp');
    launchNav = false;
    video('launch.mp4', false, () => lobby(true), () => {
      // Preserve the entry and its navigation when the browser lacks an H.264 decoder.
      const entryId = ++currentPlayback;
      const at = (delay,fn) => setTimeout(() => {
        if (entryId === currentPlayback && !root.hidden) fn();
      },delay);
      art.src = media('epic.webp');
      at(900,() => { art.src = media('loading.webp'); });
      at(3200,() => { art.src = media('discover.webp'); launchNav = true; discoverButtons(); });
      at(7200,() => lobby(true));
    });
  }

  function start(onShop, onLocker) {
    make();
    enterShop = onShop;
    enterLocker = onLocker;
    reset('home','home.webp');
    if (!isIOS()) {
      const now = new Date();
      status.querySelector('span').textContent = now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
      status.hidden = false;
    }
    button('Open Fortnite',17.65,47.7,6.8,10.2,launch);
    button('Open recent Fortnite',41.55,35.25,3.45,5.15,launch);
  }

  function hide() {
    if (!root) return;
    currentPlayback++;
    movie.onloadeddata = movie.onended = movie.onerror = null;
    movie.pause();
    root.hidden = true;
    scene = '';
    costume.replaceChildren();
  }

  window.ShopLobby = { start, returnToLobby: () => { make(); lobby(); }, hide };
})();
