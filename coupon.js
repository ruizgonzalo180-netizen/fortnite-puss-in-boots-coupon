(() => {
  'use strict';

  let panel = null;
  let badge = null;
  let modal = null;
  let previousFocus = null;
  let options = {};
  let disabledSiblings = [];

  function node(tag, className, label) {
    const element = document.createElement(tag);
    element.className = className;
    if (label) element.textContent = label;
    return element;
  }

  function button(className, label, action) {
    const result = node('button', className, label);
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
  }

  function image(name, className, alt = '') {
    const result = node('img', className);
    result.src = 'coupon-media--' + name;
    result.alt = alt;
    result.draggable = false;
    return result;
  }

  function closeSummary(restoreFocus) {
    if (!modal) return;
    modal.remove();
    modal = null;
    disabledSiblings.forEach(sibling => { sibling.inert = false; });
    disabledSiblings = [];
    if (badge) {
      badge.disabled = false;
      badge.setAttribute('aria-expanded', 'false');
      const returnTo = badge.hidden ? previousFocus : badge;
      if (restoreFocus && returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    }
    previousFocus = null;
  }

  function openSummary() {
    if (!panel?.isConnected) return;
    if (options.redeemed) {
      options.onView?.();
      return;
    }
    if (modal) return;
    const stage = panel.parentElement;
    previousFocus = document.activeElement;
    disabledSiblings = [...stage.children].filter(sibling => sibling !== panel && !sibling.inert);
    disabledSiblings.forEach(sibling => { sibling.inert = true; });
    badge.disabled = true;
    badge.setAttribute('aria-expanded', 'true');

    modal = node('div', 'coupon-backdrop');
    const card = node('section', 'coupon-summary');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'coupon-summary-title');
    const close = button('coupon-close', '\u00d7', () => closeSummary(true));
    close.setAttribute('aria-label', 'Close coupon');
    const heading = node('h2', 'coupon-heading', 'Black Friday Coupon');
    heading.id = 'coupon-summary-title';
    card.append(heading, close, image('bundle-cover.webp', 'coupon-cover', 'Puss in Boots, Death, and their accessories'));

    const body = node('div', 'coupon-body');
    const packageTitle = node('h3', 'coupon-package', 'Puss in Boots Bundle');
    const contents = node('p', 'coupon-contents', '6 items');
    body.append(packageTitle, contents);
    const price = node('div', 'coupon-price-row');
    price.append(node('span', '', 'Bundle price'), node('s', '', '2,400 V-Bucks'));
    const discount = node('div', 'coupon-price-row coupon-savings');
    discount.append(node('span', '', 'Black Friday Coupon'), node('strong', '', '\u2212100%'));
    const total = node('div', 'coupon-total');
    total.append(node('span', '', 'Total'), node('strong', '', '0 V-Bucks'));
    const use = button('coupon-apply', options.active ? 'View Bundle' : 'Apply Coupon', () => {
      const apply = options.onApply;
      closeSummary(false);
      apply?.();
    });
    body.append(price, discount, total, use);
    card.append(body);
    modal.append(card);
    panel.append(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal) closeSummary(true);
    });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeSummary(true);
      } else if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === close) {
          event.preventDefault();
          use.focus();
        } else if (!event.shiftKey && document.activeElement === use) {
          event.preventDefault();
          close.focus();
        }
      }
    });
    use.focus({ preventScroll: true });
  }

  function hide() {
    closeSummary(false);
    panel?.remove();
    panel = null;
    badge = null;
    options = {};
  }

  function show(state = {}) {
    hide();
    const stage = document.getElementById('stage');
    if (!stage) return;
    options = state;
    panel = node('div', 'shop-coupon');
    badge = button('coupon-badge', '', openSummary);
    badge.hidden = state.badge === false;
    badge.setAttribute('aria-label', state.redeemed ? 'View your Puss in Boots bundle items' : 'View Black Friday coupon for Puss in Boots');
    if (!state.redeemed) {
      badge.setAttribute('aria-haspopup', 'dialog');
      badge.setAttribute('aria-expanded', 'false');
    }
    const title = state.redeemed ? 'Bundle Redeemed' : 'Black Friday Coupon';
    const caption = state.redeemed ? 'View your items' : 'Puss in Boots';
    badge.append(
      image('gold-ribbon.png', 'coupon-ribbon'),
      image('coupon-ticket.png', 'coupon-ticket'),
      node('span', 'coupon-glint'),
      node('span', 'coupon-glint coupon-glint-small'),
      node('strong', 'coupon-badge-title', title),
      node('span', 'coupon-badge-caption', caption)
    );
    panel.append(badge);
    stage.append(panel);
  }

  window.ShopCoupon = { show, hide, openDialog: openSummary };
})();
