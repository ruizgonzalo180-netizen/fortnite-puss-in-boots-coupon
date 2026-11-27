(() => {
  'use strict';

  const items = [
    {id: 'puss', name: 'Puss in Boots', type: 'Sidekick', price: 1500},
    {id: 'death', name: 'Death (Puss in Boots)', type: 'Outfit', price: 1500},
    {id: 'sickles', name: "Death's Sickles", type: 'Pickaxe', price: 500},
    {id: 'slippers', name: 'Puss in Slippers', type: 'Kicks', price: 1000},
    {id: 'stalking', name: 'Stalking Death', type: 'Emote', price: 400},
    {id: 'bounty', name: 'Bounty in Boots', type: 'Back Bling', price: 300},
  ].map(item => ({...item, image: 'detail-media--' + item.id + '-card.webp', rewardImage: 'reward--figures--' + item.id + '.webp'}));
  const bundle = {id: 'bundle', name: 'Puss in Boots Bundle', price: 2400, originalPrice: 4700, itemIds: items.map(item => item.id)};
  const byId = new Map(items.map(item => [item.id, item]));
  const rotations = {puss: [16.57,22.17], death: [10.84,17.74], bounty: [1.94,5.84]};
  const repeatFrom = {puss: 2.17, death: 1.54, sickles: 1.30, slippers: 1.51, stalking: 0.68, bounty: 1.69};
  const sourceRoot = new URL('./', document.currentScript.src);
  const path = relative => new URL(relative, sourceRoot).href;
  const sceneAsset = name => path('detail-media--' + name) + '?v=native-entry-2';
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = path('detail.css');
  if (!document.querySelector('link[data-detail-css]') && ![...document.styleSheets].some(sheet => sheet.href === stylesheet.href)) document.head.append(stylesheet);
  let screen, opts, current, available, buying, selectedOffer;
  let movie, overlay, backFocus, muted = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function action(text, className, fn) {
    const button = el('button', className);
    button.type = 'button';
    button.setAttribute('aria-label', text);
    button.addEventListener('click', fn);
    return button;
  }

  function owned(id) {
    return opts.owned instanceof Set ? opts.owned.has(id) : Array.isArray(opts.owned) && opts.owned.includes(id);
  }

  function contents() {
    if (opts.bundle) return bundle.itemIds;
    return selectedOffer === 'death' ? ['death', 'sickles'] : [selectedOffer];
  }

  function fullPrice() {
    return opts.bundle ? bundle.price : byId.get(selectedOffer).price;
  }

  function discounted() {
    return Boolean(opts.bundle && opts.discountActive);
  }

  function closePanel() {
    if (overlay) overlay.remove();
    overlay = null;
    if (backFocus && backFocus.isConnected) backFocus.focus({preventScroll:true});
    backFocus = null;
  }

  function panel(title, description, actions = []) {
    closePanel();
    backFocus = document.activeElement;
    overlay = el('div','dd-shade');
    const card = el('div','dd-dialog');
    card.setAttribute('role','dialog');
    card.setAttribute('aria-modal','true');
    card.setAttribute('aria-label',title);
    card.append(el('h2','',title), el('p','',description));
    for (const [label, fn] of [...actions, ['Back',closePanel]]) {
      const control = action(label,'dd-panel-button',fn);
      control.textContent = label;
      card.append(control);
    }
    overlay.append(card);
    overlay.addEventListener('click',event => { if (event.target === overlay) closePanel(); });
    screen.append(overlay);
    card.querySelector('button').focus({preventScroll:true});
  }

  function close() {
    if (!screen) return;
    document.removeEventListener('keydown', onKey);
    stopMovie();
    screen.remove();
    screen = null;
    opts = overlay = backFocus = null;
  }

  function stopMovie() {
    if (!movie) return;
    movie.pause();
    movie.removeAttribute('src');
    movie.load();
    movie = null;
  }

  function back() {
    if (overlay) return closePanel();
    const callback = opts.onBack;
    close();
    callback?.();
  }

  function next(index) {
    if (!available.length) return;
    select(available[(index + available.length) % available.length]);
  }

  function onKey(event) {
    if (!screen || screen.hidden || screen.inert || screen.getAttribute('aria-hidden') === 'true' || document.querySelector('dialog[open]') || buying) return;
    if (overlay && event.key === 'Tab') {
      const buttons = [...overlay.querySelectorAll('button')];
      const atFirst = document.activeElement === buttons[0];
      const atLast = document.activeElement === buttons[buttons.length - 1];
      if (event.shiftKey && atFirst || !event.shiftKey && atLast) {
        event.preventDefault();
        buttons[event.shiftKey ? buttons.length - 1 : 0].focus();
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      back();
    } else if (!overlay && ['ArrowRight','ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      next(available.indexOf(current.id) + (event.key === 'ArrowRight' ? 1 : -1));
    }
  }

  function playVideo(video) {
    const attempt = video.play();
    if (attempt?.catch) attempt.catch(() => {
      if (movie !== video || video.muted) return;
      video.muted = true;
      video.play().catch(() => {});
    });
  }

  function addVideo() {
    const world = el('div','dd-panorama');
    world.setAttribute('aria-hidden','true');
    const video = el('video','dd-model');
    movie = video;
    video.setAttribute('playsinline','');
    video.setAttribute('webkit-playsinline','');
    video.setAttribute('aria-hidden','true');
    video.muted = muted;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.poster = sceneAsset(current.id + '-entry.webp');
    video.src = sceneAsset(current.id + '.mp4');
    video.addEventListener('error', () => {
      if (movie !== video) return;
      const fallback = el('img','dd-offline-model');
      fallback.src = path(current.rewardImage);
      fallback.alt = '';
      video.style.visibility = 'hidden';
      world.append(fallback);
    }, {once:true});
    video.addEventListener('ended', () => {
      if (video !== movie) return;
      video.currentTime = repeatFrom[current.id];
      playVideo(video);
    });
    const area = el('div','dd-turntable');
    const range = rotations[current.id];
    if (range) {
      let startX = 0, dragging = false, moved = false, phase = 0;
      area.addEventListener('pointerdown', event => {
        if (!video.duration || !Number.isFinite(video.duration)) return;
        startX = event.clientX;
        phase = Math.max(0, Math.min(1,(video.currentTime - range[0]) / (range[1] - range[0])));
        dragging = true;
        moved = false;
        area.setPointerCapture(event.pointerId);
      });
      area.addEventListener('pointermove', event => {
        if (!dragging) return;
        const dx = event.clientX - startX;
        if (!moved && Math.abs(dx) < 4) return;
        moved = true;
        video.pause();
        const fraction = (phase + dx / (area.clientWidth * 0.76)) % 1;
        video.currentTime = range[0] + (fraction < 0 ? fraction + 1 : fraction) * (range[1]-range[0]);
      });
      const release = () => { dragging = false; if (moved) playVideo(video); moved = false; };
      area.addEventListener('pointerup', release);
      area.addEventListener('pointercancel',release);
    }
    const hud = el('div','dd-native-hud');
    hud.style.backgroundImage = 'url("' + sceneAsset(current.id+'-view.webp') + '")';
    const portraitTitle = el('img','dd-portrait-title');
    portraitTitle.src = sceneAsset(current.id+'-title.webp');
    portraitTitle.alt = current.type + ': ' + current.name;
    world.append(video);
    screen.append(world,hud,portraitTitle,area);
    playVideo(video);
  }

  function select(id) {
    if (!screen || !byId.has(id)) return;
    stopMovie();
    current = byId.get(id);
    screen.replaceChildren();
    screen.setAttribute('aria-label', current.name);
    addVideo();
    addStrip();
    addOffer();
    addExtras();
  }

  function addStrip() {
    const strip = el('div','dd-strip');
    strip.setAttribute('role','group');
    strip.setAttribute('aria-label','Included items');
    const track = el('div','dd-track');
    available.forEach(id => {
      const item = byId.get(id);
      const button = action(item.name,'dd-thumb',() => select(id));
      button.setAttribute('aria-pressed',String(id === current.id));
      button.style.backgroundImage = 'url("' + path(item.image) + '")';
      track.append(button);
    });
    const overflow = available.length > 5;
    // The recorded tablet strip shifts 55 source pixels when the last item is selected.
    let end = current.id === available[available.length-1] && overflow;
    let arrow;
    function position() {
      strip.classList.toggle('dd-strip-end', end);
      strip.classList.toggle('dd-strip-start', overflow && !end);
      if (arrow) {
        arrow.textContent = end ? '\u2039' : '\u203a';
        arrow.classList.toggle('dd-arrow-prev',end);
        arrow.setAttribute('aria-label',end ? 'Previous items' : 'More items');
      }
    }
    if (overflow) {
      arrow = action('More items','dd-strip-arrow',() => { end = !end; position(); });
      let start;
      strip.addEventListener('touchstart',event => { start = event.touches[0].clientX; },{passive:true});
      strip.addEventListener('touchend',event => {
        const delta = event.changedTouches[0].clientX - start;
        if (Math.abs(delta) > 25) { end = delta < 0; position(); }
      },{passive:true});
    }
    position();
    strip.append(track);
    screen.append(strip);
    if (arrow) screen.append(arrow);
  }

  function buy() {
    if (buying || !screen) return;
    if (contents().every(owned)) {
      if (opts.bundle) opts.onViewRewards?.();
      else {
        const equipped = opts.onEquip?.(current.id);
        if (equipped && screen) {
          opts.equipped = equipped;
          const primary = screen.querySelector('.dd-primary');
          if (Object.values(equipped).includes(current.id)) {
            primary.textContent = 'EQUIPPED';
            primary.setAttribute('aria-label','Equipped');
            primary.disabled = true;
          }
        }
      }
      return;
    }
    if (!discounted() && fullPrice() > (opts.balance ?? 800)) {
      opts.onCoupon?.(setDiscount);
      return;
    }
    buying = true;
    const originalScreen = screen;
    try { opts.onBuy?.([...contents()]); }
    finally { if (screen === originalScreen) buying = false; }
  }

  function addOffer() {
    const gotAll = contents().every(owned);
    const discount = discounted();
    const balance = opts.balance ?? 800;
    const price = discount ? 0 : fullPrice();
    const equipped = gotAll && !opts.bundle && Object.values(opts.equipped || {}).includes(current.id);
    const label = gotAll ? (opts.bundle ? 'VIEW ITEMS' : equipped ? 'EQUIPPED' : 'EQUIP') : discount ? 'REDEEM' : price > balance ? 'USE COUPON' : 'PURCHASE';
    const numericBalance = el('span','dd-balance',String(balance));
    if (balance === 800) numericBalance.classList.add('dd-balance-native');
    if (opts.bundle && !gotAll && !discount && price === bundle.price) {
      const original = el('img','dd-original-price');
      original.src = path('detail-media--bundle-price.webp');
      original.alt = 'The price for included items is: 2,400 V-Bucks (originally 4,700).';
      screen.append(original);
    }
    {
      const priceRow = el('div','dd-prices');
      if (opts.bundle && !gotAll && !discount && price === bundle.price) priceRow.classList.add('dd-portrait-prices');
      const caption = gotAll ? (opts.bundle ? 'Bundle in your locker' : 'In your locker') : discount ? 'Black Friday Coupon applied' : (available.length > 1 ? 'The price for included items is:' : 'Item price');
      priceRow.append(el('div','dd-price-caption',caption));
      const amount = el('div',gotAll ? 'dd-price owned' : 'dd-price');
      if (gotAll) amount.textContent = 'OWNED';
      else {
        const coin = el('span','dd-coin','V');
        coin.setAttribute('aria-label','V-Bucks');
        amount.append(coin, document.createTextNode(price.toLocaleString('en-US')));
        if (discount) amount.append(el('s','dd-was',fullPrice().toLocaleString('en-US')));
      }
      priceRow.append(amount);
      screen.append(priceRow);
    }
    const primary = action(label,'dd-primary',buy);
    primary.textContent = label;
    primary.disabled = equipped;
    screen.append(numericBalance,primary);
  }

  function addExtras() {
    let liked = window.ShopState.favorites.includes(current.id);
    const like = action('Like ' + current.name,'dd-hit dd-like', () => {
      liked = !liked;
      like.setAttribute('aria-pressed',String(liked));
      const favorites = window.ShopState.favorites.filter(id => id !== current.id);
      if (liked) favorites.push(current.id);
      window.ShopState.favorites = favorites;
    });
    like.setAttribute('aria-pressed',String(liked));
    screen.append(like, action('Gift','dd-hit dd-gift',() => panel('GIFT', 'There are no eligible friends in this local shop.')));
    screen.append(action('Back to shop','dd-hit dd-back',back));
    const sound = action('Toggle preview audio','dd-hit dd-mic',() => {
      muted = !movie.muted;
      movie.muted = muted;
      sound.setAttribute('aria-pressed',String(muted));
    });
    sound.setAttribute('aria-pressed',String(muted));
    screen.append(sound);
    const other = action('More options','dd-more',() => {
      const entries = [
        [liked ? 'Remove from favorites' : 'Add to favorites',() => { like.click(); closePanel(); }],
        [muted ? 'Enable audio' : 'Mute audio',() => { sound.click(); closePanel(); }],
        ['Replay preview',() => { closePanel(); movie.currentTime=0; playVideo(movie); }],
        ['Gift',() => screen.querySelector('.dd-gift').click()]
      ];
      if (current.id === 'puss') entries.push(['About Sidekicks',() => screen.querySelector('.dd-about').click()]);
      panel('OPTIONS',current.name,entries);
    });
    other.textContent = '\u2022\u2022\u2022';
    screen.append(other);
    if (current.id === 'puss') {
      screen.append(action('About Sidekicks','dd-hit dd-about',() => panel('ABOUT SIDEKICKS',"Sidekicks react to the world around you. In Battle Royale, you can only see your team's Sidekicks.")));
    }
    if (['puss','slippers','sickles'].includes(current.id)) {
      screen.append(action('Options','dd-hit dd-options',() => panel('PREVIEW OPTIONS',current.name,[
        ['Replay preview',() => { closePanel(); movie.currentTime = 0; playVideo(movie); }],
        [movie.paused ? 'Resume preview' : 'Pause preview',() => { closePanel(); if (movie.paused) playVideo(movie); else movie.pause(); }]
      ])));
    }
  }

  function setDiscount(active = true) {
    if (!screen) return;
    opts.discountActive = active;
    const itemId = current.id;
    if (active) { opts.bundle = true; available = bundle.itemIds; }
    select(itemId);
  }

  function open(options = {}) {
    close();
    const stage = document.getElementById('stage');
    if (!stage) throw new Error('The shop detail requires a stage.');
    opts = {...options};
    opts.bundle = options.bundle === true || options.itemId === 'bundle';
    selectedOffer = byId.has(options.itemId) ? options.itemId : 'puss';
    available = contents();
    buying = false;
    if (typeof opts.muted === 'boolean') muted = opts.muted;
    screen = el('section','dd-screen');
    stage.append(screen);
    select(selectedOffer);
    document.addEventListener('keydown',onKey);
  }

  window.ShopDetail = {items,bundle,open,close,setDiscount};
})();
