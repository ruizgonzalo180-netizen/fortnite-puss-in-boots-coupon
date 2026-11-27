(() => {
  "use strict";

  const scriptBase = new URL(".", document.currentScript.src);
  const resource = (file) => new URL("reward--" + file.replaceAll("/", "--"), scriptBase).href;
  const figureIds = new Set(["puss", "death", "sickles", "slippers", "stalking", "bounty"]);
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = resource("reward.css");
  document.head.append(style);

  let active = false;
  let purchaseTimer;
  let playbackId = 0;
  let inventory = [];
  let selected = 0;
  let closeAction;
  let equipAction;
  let previousFocus;
  const sound = new Audio(resource("purchase.m4a"));
  sound.preload = "auto";
  sound.volume = 0.85;

  const dialog = document.createElement("dialog");
  dialog.className = "fn-reward";
  dialog.setAttribute("aria-label", "Items acquired");
  dialog.innerHTML = `
    <div class="fn-processing" aria-label="Processing purchase" role="status"><i></i></div>
    <section class="fn-stage" hidden>
      <video class="fn-plate" playsinline muted preload="auto" aria-hidden="true"></video>
      <div class="fn-heading"><h2>Items acquired</h2><p>Thanks for playing Fortnite!</p></div>
      <div class="fn-figure"><img alt=""></div>
      <div class="fn-flash" aria-hidden="true"></div>
      <div class="fn-info" aria-live="polite">
        <span class="fn-type"></span><h2 class="fn-name"></h2><p class="fn-description"></p>
      </div>
      <div class="fn-strip" role="group" aria-label="Acquired items"></div>
      <div class="fn-actions">
        <button type="button" class="fn-equip">Equip</button>
        <button type="button" class="fn-claim">Claim all</button>
      </div>
    </section>`;
  const find = (s) => dialog.querySelector(s);
  const stage = find(".fn-stage");
  const plate = find(".fn-plate");
  const figure = find(".fn-figure");
  const flash = find(".fn-flash");
  const strip = find(".fn-strip");
  const loader = find(".fn-processing");
  const equip = find(".fn-equip");
  plate.src = resource("acquisition.mp4");

  function finish(shouldEquip) {
    if (!active) return;
    active = false;
    playbackId++;
    clearTimeout(purchaseTimer);
    sound.pause();
    plate.pause();
    dialog.close();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    const item = inventory[selected];
    if (shouldEquip && typeof equipAction === "function") equipAction(item);
    if (typeof closeAction === "function") closeAction(item);
  }

  function showItem(index) {
    selected = index;
    const item = inventory[index];
    const request = ++playbackId;
    const img = figure.querySelector("img");
    const isolated = item.rewardImage || fallbackFigure(item);
    img.onerror = () => {
      if (request !== playbackId) return;
      img.onerror = null;
      figure.classList.add("fn-card-art");
      img.src = item.image;
    };
    img.src = isolated || item.image;
    figure.classList.toggle("fn-card-art", !isolated);
    find(".fn-name").textContent = item.name;
    find(".fn-type").textContent = item.type || "";
    find(".fn-description").textContent = item.description || "";
    equip.disabled = typeof equipAction !== "function";
    stage.classList.remove("fn-enter");
    void flash.offsetWidth;
    stage.classList.add("fn-enter");
    Array.from(strip.children).forEach((button, i) => {
      button.setAttribute("aria-pressed", String(index === i));
    });
    if (strip.scrollWidth > strip.clientWidth) {
      const tile = strip.children[index];
      strip.scrollLeft = tile.offsetLeft - (strip.clientWidth - tile.offsetWidth) / 2;
    }
    plate.onplaying = () => {
      if (request === playbackId) stage.classList.add("fn-native");
    };
    plate.onerror = () => stage.classList.remove("fn-native");
    plate.currentTime = 0;
    plate.play().catch(() => {
      if (request === playbackId && !plate.ended) stage.classList.remove("fn-native");
    });
  }

  function fallbackFigure(item) {
    return figureIds.has(item.id) ? resource("figures/" + item.id + ".webp") : "";
  }

  function makeThumb(item, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "Show " + item.name);
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    img.src = item.image || item.rewardImage || fallbackFigure(item);
    button.append(img);
    button.addEventListener("click", () => {
      if (index !== selected) showItem(index);
    });
    return button;
  }

  equip.addEventListener("click", () => finish(true));
  find(".fn-claim").addEventListener("click", () => finish(false));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (!stage.hidden) finish(false);
  });
  dialog.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (stage.hidden || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    const index = (selected + inventory.length + delta) % inventory.length;
    showItem(index);
    strip.children[index].focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (event) => event.stopPropagation());

  window.showReward = function showReward(items, onClose, onEquip) {
    if (active || !Array.isArray(items) || items.length === 0) return;
    if (!dialog.isConnected) document.body.append(dialog);
    active = true;
    previousFocus = document.activeElement;
    inventory = items;
    selected = 0;
    closeAction = onClose;
    equipAction = onEquip;
    stage.hidden = true;
    loader.hidden = false;
    stage.classList.remove("fn-native", "fn-enter");
    strip.replaceChildren(...inventory.map(makeThumb));
    dialog.showModal();
    sound.currentTime = 0;
    sound.play().catch(() => {});
    purchaseTimer = setTimeout(() => {
      loader.hidden = true;
      stage.hidden = false;
      showItem(0);
      find(".fn-claim").focus({ preventScroll: true });
    }, 650);
  };
})();
