(() => {
  "use strict";

  const base = new URL(".", document.currentScript.src);

  const icons = {
    back: '<path d="m13.5 5-7 7 7 7M7 12h14"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    owned: '<path d="m4.5 12.5 5 5 10-11"/>',
    equipped: '<path d="m2 13 4.5 4.5L16 7m-5 9.5 2 1.5L22 8"/>',
    shop: '<path d="M4 9h16l-1 11H5L4 9Zm4 0V7a4 4 0 0 1 8 0v2"/>'
  };
  const svg = name => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';

  let panel = null;
  let options;
  let selectedId;
  let previousFocus;
  let equipped = {};
  let cards = new Map();

  function owns(id) {
    const owned = options.owned;
    if (owned === true) return true;
    if (owned instanceof Set || owned instanceof Map) return owned.has(id);
    if (Array.isArray(owned)) return owned.some(value => (value?.id || value) === id);
    return Boolean(owned?.[id]);
  }

  function wearing(id) {
    if (!owns(id) || !equipped) return false;
    if (equipped instanceof Set) return equipped.has(id);
    const slots = equipped instanceof Map ? [...equipped.values()] : Object.values(equipped);
    return slots.some(slot => slot === id || slot?.id === id) || equipped[id] === true;
  }

  function close() {
    if (!panel) return;
    panel.remove();
    panel = null;
    cards.clear();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  function leave(callback, ...args) {
    close();
    if (typeof callback === "function") callback(...args);
  }

  function makeCard(item, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lk-card";
    button.dataset.item = item.id;
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    img.src = item.image || item.rewardImage;
    const name = document.createElement("span");
    name.className = "lk-card-name";
    name.textContent = item.name;
    const status = document.createElement("span");
    status.className = "lk-card-status";
    button.append(img, name, status);
    button.addEventListener("click", () => select(item));
    button.addEventListener("keydown", event => {
      const delta = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[event.key];
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      const count = options.items.length;
      const next = options.items[(index + delta + count) % count];
      cards.get(next.id).focus({ preventScroll: true });
      select(next);
    });
    cards.set(item.id, button);
    return button;
  }

  function refresh() {
    let ownedCount = 0;
    for (const item of options.items) {
      const own = owns(item.id);
      const equippedItem = wearing(item.id);
      ownedCount += Number(own);
      const state = equippedItem ? "equipped" : own ? "owned" : "lock";
      const label = state === "lock" ? "Locked" : state === "owned" ? "Owned" : "Equipped";
      const tile = cards.get(item.id);
      tile.dataset.status = state;
      tile.setAttribute("aria-label", item.name + ", " + label);
      tile.setAttribute("aria-pressed", String(item.id === selectedId));
      tile.lastChild.innerHTML = svg(state);
    }
    panel.querySelector(".lk-count").textContent = ownedCount + " / " + options.items.length + " owned";
  }

  function select(item) {
    const changed = selectedId !== item.id;
    selectedId = item.id;
    refresh();
    const own = owns(item.id);
    const active = wearing(item.id);
    panel.querySelector(".lk-type").textContent = item.type || "";
    panel.querySelector(".lk-item-name").textContent = item.name;
    const state = panel.querySelector(".lk-state");
    state.dataset.owned = String(own);
    state.innerHTML = svg(own ? active ? "equipped" : "owned" : "lock");
    state.append(document.createTextNode(active ? "Equipped" : own ? "Owned" : "Locked"));
    const action = panel.querySelector(".lk-primary");
    action.textContent = own ? active ? "Unequip" : "Equip" : "View in Shop";
    action.disabled = typeof (own ? options.onEquip : options.onShop) !== "function";
    action.onclick = () => {
      if (!own) return leave(options.onShop, item.id);
      const next = options.onEquip(item.id);
      if (next !== undefined) equipped = next;
      if (panel) select(item);
    };
    if (changed) {
      const figure = panel.querySelector(".lk-figure");
      figure.classList.remove("lk-appear");
      const img = figure.querySelector("img");
      img.alt = item.name;
      img.onerror = () => {
        img.onerror = null;
        if (item.image) img.src = item.image;
      };
      img.src = item.rewardImage || new URL("reward--figures--" + encodeURIComponent(item.id) + ".webp", base).href;
      void figure.offsetWidth;
      figure.classList.add("lk-appear");
    }
  }

  function open(settings) {
    close();
    const stage = document.getElementById("stage");
    if (!stage || !settings || !Array.isArray(settings.items)) return;
    options = settings;
    equipped = settings.equipped || {};
    selectedId = null;
    previousFocus = document.activeElement;
    panel = document.createElement("section");
    panel.className = "fn-locker";
    panel.setAttribute("aria-label", "Locker");
    panel.innerHTML = `
      <header class="lk-header">
        <button type="button" class="lk-back" aria-label="Back">${svg("back")}</button>
        <h1>Locker</h1>
      </header>
      <div class="lk-collection">
        <div class="lk-collection-head"><h2>Puss in Boots</h2><span class="lk-count"></span></div>
        <div class="lk-grid" role="group" aria-label="Bundle collection"></div>
        <button class="lk-bundle" type="button">${svg("shop")} View bundle</button>
      </div>
      <div class="lk-preview">
        <div class="lk-spot"></div>
        <div class="lk-figure"><img alt="" draggable="false"></div>
        <div class="lk-selected"><span class="lk-type"></span><h2 class="lk-item-name"></h2><span class="lk-state"></span></div>
        <button class="lk-primary" type="button"></button>
      </div>`;
    stage.append(panel);
    panel.querySelector(".lk-back").onclick = () => leave(settings.onBack);
    const bundle = panel.querySelector(".lk-bundle");
    bundle.disabled = typeof settings.onShop !== "function";
    bundle.onclick = () => leave(settings.onShop);
    panel.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      event.preventDefault();
      leave(settings.onBack);
    });
    const grid = panel.querySelector(".lk-grid");
    grid.replaceChildren(...settings.items.map(makeCard));
    const initial = settings.items.find(item => wearing(item.id)) || settings.items.find(item => owns(item.id)) || settings.items[0];
    if (initial) {
      select(initial);
      cards.get(initial.id).focus({ preventScroll: true });
    } else {
      panel.querySelector(".lk-count").textContent = "0 owned";
      panel.querySelector(".lk-preview").hidden = true;
      bundle.focus({ preventScroll: true });
    }
  }
  window.ShopLocker = { open, close };
})();
