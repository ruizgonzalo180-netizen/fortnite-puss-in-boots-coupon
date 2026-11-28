(() => {
  "use strict";

  let layer;
  const revision = new URL(document.currentScript.src).search;

  function image(file, className) {
    const element = document.createElement("img");
    element.className = className;
    element.src = "coupon-media--" + file + revision;
    element.alt = "";
    element.draggable = false;
    return element;
  }

  function label(tag, className, text = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function hide() {
    layer?.remove();
    layer = null;
  }

  function show({status, onRedeem, onBundle, onView}) {
    hide();
    const redeemed = status === "redeemed";
    const active = status === "active";
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = "coupon-badge";
    badge.setAttribute("aria-label", redeemed ? "View your Puss in Boots bundle items" : active ? "View discounted Puss in Boots bundle" : "Redeem Black Friday coupon for Puss in Boots");
    badge.addEventListener("click", redeemed ? onView : active ? onBundle : onRedeem);
    badge.append(
      image("gold-ribbon.png", "coupon-ribbon"),
      image("coupon-ticket.png", "coupon-ticket"),
      label("span", "coupon-glint"),
      label("span", "coupon-glint coupon-glint-small"),
      label("strong", "coupon-badge-title", redeemed ? "Bundle Redeemed" : active ? "Coupon Applied" : "Black Friday Coupon"),
      label("span", "coupon-badge-caption", redeemed ? "View your items" : active ? "0 V-Bucks" : "Puss in Boots")
    );
    layer = document.createElement("div");
    layer.className = "shop-coupon";
    layer.append(badge);
    document.getElementById("stage").append(layer);
  }

  window.ShopCoupon = {show, hide};
})();
