(() => {
  "use strict";

  const key = "puss-in-boots.black-friday.v1";
  const params = new URLSearchParams(location.search);
  const rehearsal = params.get("replay") === "1";
  const items = window.ShopDetail.items;
  const byId = new Map(items.map(item => [item.id, item]));
  const slots = {puss:"sidekick", death:"outfit", sickles:"pickaxe", slippers:"kicks", stalking:"emote", bounty:"backbling"};
  let state;
  let screen;
  let product;
  let busy = false;
  const initial = () => ({balance:800, owned:[], equipped:{}, coupon:"available"});

  function readState() {
    if (rehearsal) return state || initial();
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch { return state || initial(); }
    if (!saved || !Array.isArray(saved.owned)) return state || initial();
    const owned = [...new Set(saved.owned.filter(id => byId.has(id)))];
    const equipped = {};
    for (const id of owned) {
      if (saved.equipped?.[slots[id]] === id) equipped[slots[id]] = id;
    }
    return {
      balance: Number.isSafeInteger(saved.balance) && saved.balance >= 0 ? saved.balance : 800,
      owned, equipped,
      coupon: owned.length === items.length ? "redeemed" : saved.coupon === "active" ? "active" : "available"
    };
  }

  function save() {
    window.ShopState = state;
    if (!rehearsal) {
      try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
    }
  }

  function clearScreens() {
    ShopCoupon.hide();
    ShopCatalog.close();
    ShopDetail.close();
    ShopLocker.close();
    ShopLobby.hide();
  }

  function redeemCoupon() {
    if (screen === "catalog" || screen === "detail") {
      purchase({id:"puss", bundle:true}, true);
    }
  }

  function equip(id, toggle = false) {
    state = readState();
    if (!state.owned.includes(id)) return state.equipped;
    const slot = slots[id];
    if (toggle && state.equipped[slot] === id) delete state.equipped[slot];
    else state.equipped[slot] = id;
    save();
    return {...state.equipped};
  }

  function openCatalog() {
    clearScreens();
    screen = "catalog";
    window.ShopIPadDisplay?.setScene(screen);
    product = null;
    ShopCatalog.open({
      owned:state.owned, balance:state.balance, discountActive:state.coupon === "active",
      onItem:openDetail, onBack:openLobby, onCoupon:redeemCoupon, onLocker:openLocker
    });
    ShopCoupon.show({redeemed:state.coupon === "redeemed", onRedeem:redeemCoupon, onView:openLocker});
  }

  function openDetail(id = "puss", bundle = false) {
    clearScreens();
    screen = "detail";
    window.ShopIPadDisplay?.setScene(screen);
    product = {id, bundle};
    ShopDetail.open({
      itemId:id, bundle, owned:state.owned, equipped:state.equipped, balance:state.balance,
      discountActive:state.coupon === "active", onBuy:() => purchase({id, bundle}), onBack:openCatalog,
      onCoupon:redeemCoupon, onViewRewards:openLocker,
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
    window.ShopIPadDisplay?.setScene(screen);
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

  function purchase(offer, withCoupon = false) {
    if (busy) return;
    busy = true;
    function complete() {
      state = readState();
      const ids = offer.bundle ? items.map(item => item.id) :
        offer.id === "death" ? ["death", "sickles"] : [offer.id];
      const newIds = ids.filter(id => byId.has(id) && !state.owned.includes(id));
      if (!newIds.length) { busy = false; openLocker(); return; }
      const discount = withCoupon || (offer.bundle && state.coupon === "active");
      const cost = discount ? 0 : offer.bundle ? ShopDetail.bundle.price : byId.get(offer.id).price;
      if (!Number.isFinite(cost) || cost > state.balance) {
        busy = false;
        openDetail(offer.id, offer.bundle);
        return;
      }
      state.balance -= cost;
      state.owned.push(...newIds);
      if (items.every(item => state.owned.includes(item.id))) state.coupon = "redeemed";
      save();
      screen = "reward";
      window.ShopIPadDisplay?.setScene(screen);
      ShopCoupon.hide();
      document.querySelectorAll("#stage video, #stage audio").forEach(media => media.pause());
      showReward(newIds.map(id => byId.get(id)), () => {
        busy = false;
        openCatalog();
      }, item => equip(item.id));
    }
    if (!rehearsal && navigator.locks?.request) {
      navigator.locks.request(key, complete).catch(() => { busy = false; });
    } else complete();
  }

  state = readState();
  window.ShopState = state;
  window.addEventListener("storage", event => {
    if (rehearsal || event.key !== key) return;
    state = readState();
    window.ShopState = state;
    if (screen === "catalog") openCatalog();
    else if (screen === "locker") openLocker();
    else if (screen === "detail" && product && !busy) openDetail(product.id, product.bundle);
  });
  screen = "lobby";
  ShopLobby.start(openCatalog, openLocker);
  if (params.get("shop") === "1") openCatalog();
})();
