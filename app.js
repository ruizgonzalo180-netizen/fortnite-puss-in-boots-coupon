(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const items = window.ShopDetail.items;
  const byId = new Map(items.map(item => [item.id, item]));
  const slots = {puss:"sidekick", death:"outfit", sickles:"pickaxe", slippers:"kicks", stalking:"emote", bounty:"backbling"};
  const state = {balance:800, owned:[], equipped:{}, coupon:"available", favorites:[], creator:""};
  window.ShopState = state;
  let screen;
  let busy = false;

  function clearScreens() {
    ShopCoupon.hide();
    ShopCatalog.close();
    ShopDetail.close();
    ShopLocker.close();
    ShopLobby.hide();
  }

  function equip(id, toggle = false) {
    if (!state.owned.includes(id)) return state.equipped;
    const slot = slots[id];
    if (toggle && state.equipped[slot] === id) delete state.equipped[slot];
    else state.equipped[slot] = id;
    return {...state.equipped};
  }

  function openCatalog() {
    clearScreens();
    screen = "catalog";
    ShopCatalog.open({
      owned:state.owned, balance:state.balance, onItem:openDetail,
      onBack:openLobby, onLocker:openLocker
    });
    ShopCoupon.show({
      status:state.coupon, onBundle:() => openDetail("puss", true), onView:openLocker
    });
  }

  function openDetail(id = "puss", bundle = false) {
    clearScreens();
    screen = "detail";
    ShopDetail.open({
      itemId:id, bundle, owned:state.owned, equipped:state.equipped, balance:state.balance,
      onBuy:() => purchase({id, bundle}), onBack:openCatalog,
      onViewRewards:openLocker,
      onEquip(item) {
        const changed = equip(typeof item === "string" ? item : item.id);
        return changed;
      }
    });
  }

  function openLocker() {
    const returnTo = screen === "lobby" ? openLobby : openCatalog;
    clearScreens();
    screen = "locker";
    ShopLocker.open({
      items, owned:state.owned, equipped:state.equipped, onBack:returnTo,
      onEquip:id => equip(id, true), onShop:id => openDetail(id || "puss", !id)
    });
  }

  function openLobby() {
    clearScreens();
    screen = "lobby";
    ShopLobby.returnToLobby();
  }

  function purchase(offer) {
    if (busy) return;
    busy = true;
    const ids = offer.bundle ? items.map(item => item.id) :
      offer.id === "death" ? ["death", "sickles"] : [offer.id];
    const newIds = ids.filter(id => byId.has(id) && !state.owned.includes(id));
    if (!newIds.length) { busy = false; openLocker(); return; }
    state.owned.push(...newIds);
    if (items.every(item => state.owned.includes(item.id))) state.coupon = "redeemed";
    screen = "reward";
    ShopCoupon.hide();
    document.querySelectorAll("#stage video, #stage audio").forEach(media => media.pause());
    showReward(newIds.map(id => byId.get(id)), () => {
      busy = false;
      openCatalog();
    }, item => equip(item.id));

  }

  // iPadOS can reopen the same document from the Home Screen without navigating.
  let leftApp = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      leftApp = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches ||
        (matchMedia("(display-mode: fullscreen)").matches && !document.fullscreenElement);
    } else if (leftApp) {
      leftApp = false;
      location.reload();
    }
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted) location.reload();
  });
  screen = "lobby";
  ShopLobby.start(openCatalog, openLocker);
  if (params.get("shop") === "1") openCatalog();
})();
