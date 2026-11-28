(() => {
  'use strict';
  const moduleBase = new URL('.', document.currentScript?.src || document.baseURI);
  const media = name => new URL('catalog-media--' + name + '.webp', moduleBase).href;
  if (!document.querySelector('link[data-catalog-css]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = new URL('catalog.css', moduleBase).href;
    document.head.append(css);
  }

  const cards = [
    {id:'bundle', name:'Puss in Boots Bundle', rect:[448,298,1121,352]},
    {id:'puss', name:'Puss in Boots', rect:[448,657,554,379]},
    {id:'death', name:'Death (Puss in Boots)', rect:[1015,671,554,365]},
    {id:'slippers', name:'Puss in Slippers', rect:[448,1100,271,323]},
    {id:'bounty', name:'Bounty in Boots', rect:[731,1100,271,323]},
    {id:'stalking', name:'Stalking Death', rect:[1015,1100,271,323]},
    {id:'sickles', name:"Death's Sickles", rect:[1298,1100,271,323]}
  ];
  const shelfLeft = 2266 * .182;
  const shelfTop = 1488 * .167;
  let root, options, shelf, rail, panel, ticker, rememberedScroll = 0;
  let keyHandler;

  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content != null) element.textContent = content;
    return element;
  }
  function button(label, action, className) {
    const b = node('button', className);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', action);
    return b;
  }
  function position(element, rect) {
    const [x,y,w,h] = rect;
    element.style.setProperty('--pc-x',(x/2266*100)+'cqw');
    element.style.setProperty('--pc-y',(y/1488*100)+'cqh');
    element.style.setProperty('--pc-w',(w/2266*100)+'cqw');
    element.style.setProperty('--pc-h',(h/1488*100)+'cqh');
    element.style.setProperty('--pc-ratio', w + ' / ' + h);
  }
  function hit(label, rect, onClick, className = 'pc-hit', host = root) {
    const b = button(label,onClick,className);
    position(b, rect);
    host.append(b);
    return b;
  }
  function getOwned(id) {
    const o = options.owned;
    if (typeof o === 'function') return !!o(id);
    if (o?.has) return o.has(id);
    if (Array.isArray(o)) return o.includes(id);
    return !!o?.[id];
  }
  function select(c) {
    dismiss();
    rememberedScroll = shelf?.scrollTop || 0;
    options.onItem?.(c.id === 'bundle' ? 'puss' : c.id, c.id === 'bundle');
  }
  function dismiss() {
    if (!panel) return;
    const previous = panel.previous;
    panel.remove();
    panel = null;
    if (previous?.isConnected && previous.focus) previous.focus({preventScroll:true});
  }
  function dialog(title, build) {
    dismiss();
    panel = node('div','pc-panel-cover');
    panel.previous = document.activeElement;
    panel.addEventListener('click',e => {if(e.target === panel) dismiss();});
    const box = node('section','pc-panel');
    box.setAttribute('role','dialog');
    box.setAttribute('aria-modal','true');
    box.setAttribute('aria-label',title);
    const head = node('header');
    const exit = button('Close',dismiss);
    exit.textContent = '×';
    head.append(node('h2','',title),exit);
    box.append(head);
    build(box);
    panel.append(box);
    root.append(panel);
    (box.querySelector('input') || exit).focus({preventScroll:true});
  }
  function itemList(title, available, searchable) {
    dialog(title, box => {
      let query;
      const results = node('div','pc-results');
      function fill() {
        const q = query?.value.trim().toLowerCase() || '';
        results.replaceChildren();
        for (const c of available.filter(c => c.name.toLowerCase().includes(q))) {
          const result = button(c.name,() => select(c));
          result.textContent = c.name;
          results.append(result);
        }
        if(!results.childElementCount) results.append(node('p','',q?'No matching items.':'No items yet.'));
      }
      if (searchable) {
        query = node('input');
        query.type = 'search';
        query.placeholder = 'Search the shop';
        query.setAttribute('aria-label',query.placeholder);
        query.addEventListener('input',fill);
        box.append(query);
      }
      fill();
      box.append(results);
    });
  }
  function note(title, body) { dialog(title,box => box.append(node('p','',body))); }
  function goBack() {
    rememberedScroll = 0;
    options.onBack?.();
  }
  function supportCreator() {
    dialog('Support a Creator', box => {
      const input = node('input');
      input.setAttribute('aria-label','Creator code');
      input.placeholder = 'Enter a creator code';
      input.maxLength = 16;
      input.value = window.ShopState.creator;
      const save = button('Accept',() => {
        const code = input.value.trim().replace(/[^a-z0-9_-]/gi,'');
        window.ShopState.creator = code;
        dismiss();
        updateCreator();
      });
      save.textContent = 'Accept';
      box.append(input,save);
    });
  }
  function updateCreator() {
    const first = root.querySelector('.pc-footer');
    if (!first) return;
    first.querySelector('.pc-creator')?.remove();
    const code = window.ShopState.creator;
    if(code) {
      const label = node('span','pc-creator','SUPPORT-A-CREATOR: '+code.toUpperCase());
      Object.assign(label.style,{position:'absolute',inset:'9% 3%',display:'grid',placeItems:'center',background:'#4065a2',borderRadius:'.5cqw',color:'#071c38',fontWeight:'900',fontSize:'1.14cqw'});
      first.append(label);
    }
  }
  function mountHud() {
    const nav = node('nav','pc-nav');
    nav.setAttribute('aria-label','Shop navigation');
    root.append(nav);
    function navButton(label,rect,action) {
      const b = hit(label,rect,action,'pc-hit',nav);
      const [x,y,w,h] = rect;
      b.style.setProperty('--nav-left',(x-48)/1312*100+'%');
      b.style.setProperty('--nav-top',y/137*100+'%');
      b.style.setProperty('--nav-width',w/1312*100+'%');
      b.style.setProperty('--nav-height',h/137*100+'%');
    }
    navButton('Search',[48,0,116,117],() => itemList('Search',cards,true));
    navButton('Favorites',[166,0,112,117],() => {
      const saved = window.ShopState.favorites;
      itemList('Favorites',cards.filter(c => saved.includes(c.id)),false);
    });
    navButton('Play — return to lobby',[277,0,115,120],goBack);
    navButton('Shop',[506,8,120,125],() => shelf.scrollTo({top:0,behavior:'smooth'}));
    if (options.onLocker) navButton('Locker',[394,0,114,118],() => options.onLocker());
    navButton('V-Bucks balance',[1206,0,169,114],() => note('V-Bucks',Number(options.balance ?? 800).toLocaleString('en-US')+' V-Bucks'));
    const balance = Number(options.balance ?? 800);
    nav.append(node('span','pc-balance'+(balance===800?' pc-native-balance':''),balance.toLocaleString('en-US')));
    hit('Browse Puss in Boots items',[310,149,92,91],() => itemList('Puss in Boots',cards,false),'pc-hit pc-filter');
    hit('Scroll through Puss in Boots',[310,261,94,759],e => {
      const bounds = e.currentTarget.getBoundingClientRect();
      const fraction = Math.max(0,Math.min(1,(e.clientY - bounds.top)/bounds.height));
      shelf.scrollTo({top:fraction*(shelf.scrollHeight-shelf.clientHeight),behavior:'smooth'});
    },'pc-hit pc-rail-hit');
    const controls = [
      ['Support a Creator',[1213,1360,480,77],supportCreator],
      ['About Shop',[1714,1360,249,77],() => note('About Shop','Select a card to preview an item. Choose Use Coupon to claim the selected offer for 0 V-Bucks.')],
      ['Voice Chat',[1983,1360,77,77],() => note('Voice Chat','No party members connected.')],
      ['Chat',[2080,1360,142,77],() => note('Party Chat','No party members connected.')]
    ];
    const footer = node('footer','pc-footers');
    root.append(footer);
    controls.forEach(([title,rect,fn],i) => {
      const b = hit(title,rect,fn,'pc-footer',footer);
      const img = node('img');
      img.alt = '';
      img.src = media('footer-'+i);
      b.append(img);
    });
    updateCreator();
  }
  function open(input={}) {
    close();
    options = input;
    root = node('section');
    root.id = 'puss-catalog';
    root.setAttribute('aria-label','Fortnite shop');
    root.append(node('div','pc-shade'));
    shelf = node('div','pc-shelf');
    shelf.tabIndex = -1;
    const rows = node('div','pc-rows');
    let bundleImage;
    for (const c of cards) {
      const isBundle = c.id === 'bundle';
      const owned = isBundle ? cards.slice(1).every(x => getOwned(x.id)) : getOwned(c.id);
      const b = button(c.name+(owned ? ', owned' : ', 0 V-Bucks'),() => select(c),'pc-card');
      b.dataset.item = c.id;
      const [x,y,w,h] = c.rect;
      position(b,[x-shelfLeft,y-shelfTop,w,h]);
      const img = node('img');
      img.alt = '';
      img.draggable = false;
      img.src = media(c.id);
      b.append(img);
      if(isBundle) bundleImage = img;
      if (owned) {
        b.append(node('span','pc-price owned','OWNED'));
      } else {
        const price = node('span', 'pc-price coupon');
        const original = isBundle ? ShopDetail.bundle.price : ShopDetail.items.find(item => item.id === c.id).price;
        price.append(node('span', 'pc-coin', 'V'), ' 0 ', node('s', '', original.toLocaleString('en-US')));
        b.append(price);
      }
      rows.append(b);
    }
    shelf.append(rows);
    root.append(shelf,node('div','pc-bar-wash'));
    rail = node('div','pc-rail-fill');
    rail.style.setProperty('--rail-offset','0%');
    root.append(rail);
    shelf.addEventListener('scroll',() => {
      const distance = shelf.scrollHeight - shelf.clientHeight;
      rail.style.setProperty('--rail-offset',(distance ? 25*shelf.scrollTop/distance : 0)+'%');
    },{passive:true});
    mountHud();
    document.getElementById('stage').append(root);
    shelf.scrollTop = rememberedScroll;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const variants = ['bundle-bare','bundle-wolf','bundle'];
      let frame = 0;
      ticker = setInterval(() => {
        if(!document.hidden) bundleImage.src = media(variants[frame++ % variants.length]);
      },2850);
    }
    keyHandler = e => {
      if(e.key !== 'Escape' || !root?.isConnected || e.defaultPrevented) return;
      // The coupon and locker can open above the shop. Their active element or
      // overlay owns Back until that view is dismissed.
      const atCenter = document.elementFromPoint(innerWidth/2,innerHeight/2);
      if(atCenter && !root.contains(atCenter)) return;
      e.preventDefault();
      e.stopPropagation();
      if(panel) dismiss(); else goBack();
    };
    document.addEventListener('keydown',keyHandler);
  }
  function close() {
    clearInterval(ticker);
    if(keyHandler) document.removeEventListener('keydown',keyHandler);
    root?.remove();
    root = shelf = panel = rail = keyHandler = null;
  }
  window.ShopCatalog = {open,close};
})();
