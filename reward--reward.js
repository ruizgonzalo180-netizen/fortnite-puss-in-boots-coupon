(() => {
  "use strict";

  const scriptBase = new URL(".", document.currentScript.src);
  const resource = (file) => new URL("reward--" + file.replaceAll("/", "--"), scriptBase).href;
  const figureIds = new Set(["puss", "death", "sickles", "slippers", "stalking", "bounty"]);
  const geometry = {
    puss: {w:444,h:570,iw:518,ih:836,dx:-37,dy:-189.69,seconds:10.833333},
    death: {w:446,h:756,iw:518,ih:916,dx:-39.82,dy:-119.62,seconds:.458333},
    sickles: {w:576,h:416,iw:648,ih:1148,dx:-51.3,dy:-380.06,seconds:.5},
    slippers: {w:604,h:440,iw:706,ih:826,dx:-51.04,dy:-322.78,seconds:.666667},
    stalking: {w:712,h:660,iw:712,ih:660,dx:0,dy:0,seconds:.333333},
    bounty: {w:348,h:670,iw:390,ih:734,dx:-21.99,dy:-28.28,seconds:.916667}
  };
  let imageSequence = 0;
  const animationBytes = new Map();

  function freshAnimationURL(url, sequence) {
    if (location.protocol === "file:") return Promise.resolve(url + "?play=" + sequence);
    if (!animationBytes.has(url)) {
      animationBytes.set(url, fetch(url).then(response => {
        if (!response.ok) throw Error("Animation unavailable");
        return response.blob();
      }).catch(error => {
        animationBytes.delete(url);
        throw error;
      }));
    }
    return animationBytes.get(url).then(bytes => URL.createObjectURL(bytes));
  }

  function discardPreviewImage(image) {
    if (!image) return;
    image.onload = image.onerror = null;
    image.remove();
    if (image.src.startsWith("blob:")) URL.revokeObjectURL(image.src);
  }

  function alignMedia(element, container, id, intro) {
    const {w,h,iw,ih,dx,dy} = geometry[id];
    const width = container.clientWidth;
    const height = container.clientHeight;
    const scale = Math.min(width / w, height / h);
    element.style.width = (intro ? iw : w) * scale + "px";
    element.style.height = (intro ? ih : h) * scale + "px";
    element.style.left = (width - w * scale) / 2 + (intro ? dx * scale : 0) + "px";
    element.style.top = (height - h * scale) / 2 + (intro ? dy * scale : 0) + "px";
  }

  function preview(container, id, firstPhase = "intro", onPaint, onFailure) {
    if (!container || !figureIds.has(id)) return null;
    let phase = firstPhase;
    let mounted;
    let pending;
    let timer;
    let alive = true;
    const sequence = ++imageSequence;
    container.classList.add("fn-preview-live");
    const resize = new ResizeObserver(() => {
      if (mounted) alignMedia(mounted, container, id, phase === "intro");
    });
    resize.observe(container);
    function remove() {
      alive = false;
      clearTimeout(timer);
      resize.disconnect();
      discardPreviewImage(pending);
      discardPreviewImage(mounted);
      container.classList.remove("fn-preview-live");
    }
    function load(folder) {
      const image = new Image();
      pending = image;
      image.className = "fn-preview-image";
      image.dataset.phase = folder;
      image.setAttribute("aria-hidden", "true");
      image.draggable = false;
      image.onload = () => {
        if (!alive) return;
        phase = folder;
        alignMedia(image, container, id, folder === "intro");
        container.append(image);
        discardPreviewImage(mounted);
        mounted = image;
        pending = null;
        container.classList.add("fn-preview-live");
        onPaint?.(folder);
        if (folder === "intro") timer = setTimeout(() => load("motion"), geometry[id].seconds * 1000);
      };
      image.onerror = () => {
        if (!alive) return;
        if (folder === "intro") { discardPreviewImage(image); load("motion"); }
        else { remove(); onFailure?.(); }
      };
      const url = resource(folder + "/" + id + ".webp");
      freshAnimationURL(url, sequence).then(src => {
        if (alive && image === pending) image.src = src;
        else if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      }).catch(() => { if (alive && image === pending) image.src = url + "?play=" + sequence; });
    }
    load(firstPhase);
    return remove;
  }
  window.ShopRewardMotion = {preview: (container, id) => preview(container, id)};
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = resource("reward.css") + new URL(document.currentScript.src).search;
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
      <div class="fn-heading"><h2>Items acquired</h2><p>Thanks for playing Fortnite!</p></div>
      <div class="fn-figure"><img alt=""><video class="fn-motion-source" playsinline muted loop preload="none" aria-hidden="true"></video></div>
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
  const figure = find(".fn-figure");
  const strip = find(".fn-strip");
  const loader = find(".fn-processing");
  const equip = find(".fn-equip");
  const movie = find(".fn-motion-source");
  let canvas = document.createElement("canvas");
  canvas.className = "fn-motion-canvas";
  canvas.setAttribute("aria-hidden", "true");
  figure.append(canvas);
  let painter;
  let pendingFrame;
  let expectedVideo = "";
  let removeImagePreview;
  let revealTimer;
  let paintedPhase;
  let painterItem;
  new ResizeObserver(() => {
    if (paintedPhase) alignMedia(canvas, figure, painterItem, paintedPhase === "intro");
  }).observe(figure);

  // Each H.264 frame carries the original color image above the matching matte.
  // The two halves share a decoder, timestamp and loop point on Safari.
  function makeGpuPainter() {
    const gl = canvas.getContext("webgl", {
      alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false
    });
    if (!gl) return null;
    const program = gl.createProgram();
    function shader(type, code) {
      const unit = gl.createShader(type);
      gl.shaderSource(unit, code);
      gl.compileShader(unit);
      if (!gl.getShaderParameter(unit, gl.COMPILE_STATUS)) throw Error("Motion shader unavailable");
      gl.attachShader(program, unit);
      gl.deleteShader(unit);
    }
    shader(gl.VERTEX_SHADER, "attribute vec2 point; varying vec2 uv; void main(){ uv=vec2(point.x*.5+.5,.5-point.y*.5); gl_Position=vec4(point,0.,1.); }");
    shader(gl.FRAGMENT_SHADER, "precision mediump float; uniform sampler2D frame; varying vec2 uv; void main(){ vec2 p=vec2(uv.x,uv.y*.5); vec3 rgb=texture2D(frame,p).rgb; float alpha=texture2D(frame,p+vec2(0.,.5)).r; gl_FragColor=vec4(rgb,alpha); }");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error("Motion program unavailable");
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const point = gl.getAttribLocation(program, "point");
    gl.enableVertexAttribArray(point);
    gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, "frame"), 0);
    return () => {
      if (gl.isContextLost()) throw Error("Motion context interrupted");
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, movie);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }

  function useSoftwarePainter() {
    const old = canvas;
    canvas = old.cloneNode();
    old.replaceWith(canvas);
    const output = canvas.getContext("2d");
    const packed = document.createElement("canvas");
    const reader = packed.getContext("2d", {willReadFrequently: true});
    return () => {
      if (packed.width !== canvas.width || packed.height !== canvas.height * 2) {
        packed.width = canvas.width;
        packed.height = canvas.height * 2;
      }
      reader.drawImage(movie, 0, 0, packed.width, packed.height);
      const pixels = reader.getImageData(0, 0, packed.width, packed.height);
      const rgba = pixels.data;
      const half = rgba.length / 2;
      for (let i = 0; i < half; i += 4) rgba[i + 3] = rgba[half + i];
      output.putImageData(pixels, 0, 0, 0, 0, canvas.width, canvas.height);
    };
  }

  function stopMotion(keepFrame = false) {
    expectedVideo = "";
    clearTimeout(revealTimer);
    if (!keepFrame) {
      paintedPhase = null;
      removeImagePreview?.();
      removeImagePreview = null;
      figure.classList.remove("fn-moving", "fn-image-mode", "fn-waiting");
    }
    movie.onplaying = null;
    movie.onerror = null;
    movie.onended = null;
    if (pendingFrame !== undefined) {
      if (movie.cancelVideoFrameCallback) movie.cancelVideoFrameCallback(pendingFrame);
      else cancelAnimationFrame(pendingFrame);
      pendingFrame = undefined;
    }
    if (movie.hasAttribute("src")) {
      movie.pause();
      movie.removeAttribute("src");
      movie.load();
    }
  }

  function playMotion(item, request, folder = "intro") {
    stopMotion(folder === "motion");
    if (!figureIds.has(item.id)) return;
    if (folder === "intro") figure.classList.add("fn-waiting");
    expectedVideo = resource(folder + "/" + item.id + ".mp4");
    movie.loop = folder === "motion";
    let lastTime = -1;
    let imageFallback = false;
    function useAnimatedImage() {
      if (request !== playbackId || !active || imageFallback) return;
      imageFallback = true;
      stopMotion(true);
      removeImagePreview = preview(figure, item.id, folder, phase => {
        if (request !== playbackId || !active) return;
        figure.dataset.phase = phase;
        figure.classList.remove("fn-waiting");
        figure.classList.add("fn-moving", "fn-image-mode");
      }, () => figure.classList.remove("fn-moving", "fn-image-mode", "fn-waiting"));
    }
    function draw() {
      pendingFrame = undefined;
      if (!active || request !== playbackId || movie.currentSrc !== expectedVideo) return;
      if (movie.readyState >= 2 && movie.videoHeight > 0 && lastTime !== movie.currentTime) {
        const height = movie.videoHeight / 2;
        if (canvas.width !== movie.videoWidth || canvas.height !== height) {
          canvas.width = movie.videoWidth;
          canvas.height = height;
        }
        if (paintedPhase !== folder || painterItem !== item.id) {
          paintedPhase = folder;
          painterItem = item.id;
          alignMedia(canvas, figure, item.id, folder === "intro");
        }
        try {
          if (!painter) painter = makeGpuPainter() || useSoftwarePainter();
          painter();
        } catch {
          try { painter = useSoftwarePainter(); painter(); }
          catch { useAnimatedImage(); return; }
        }
        lastTime = movie.currentTime;
        figure.dataset.phase = folder;
        figure.classList.remove("fn-waiting");
        figure.classList.add("fn-moving");
      }
      pendingFrame = movie.requestVideoFrameCallback ? movie.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
    }
    movie.onerror = useAnimatedImage;
    movie.onplaying = () => { if (pendingFrame === undefined) draw(); };
    movie.onended = () => {
      if (folder === "intro" && active && request === playbackId) playMotion(item, request, "motion");
    };
    movie.muted = true;
    movie.src = expectedVideo;
    movie.play().catch(useAnimatedImage);
  }

  function finish(shouldEquip) {
    if (!active) return;
    active = false;
    playbackId++;
    clearTimeout(purchaseTimer);
    sound.pause();
    stopMotion();
    dialog.close();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    const item = inventory[selected];
    if (shouldEquip && typeof equipAction === "function") equipAction(item);
    if (typeof closeAction === "function") closeAction(item);
  }

  function showItem(index, first = false) {
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
    stopMotion();
    figure.dataset.phase = "pending";
    if (figureIds.has(item.id)) {
      figure.classList.add("fn-waiting");
      // The acquisition recording shows the empty stage, then the cyan scanner.
      revealTimer = setTimeout(() => {
        if (request === playbackId && active) playMotion(item, request);
      }, first ? 430 : 90);
    }
    find(".fn-name").textContent = item.name;
    find(".fn-type").textContent = item.type || "";
    find(".fn-description").textContent = item.description || "";
    equip.disabled = typeof equipAction !== "function";
    stage.classList.remove("fn-enter");
    void figure.offsetWidth;
    stage.classList.add("fn-enter");
    Array.from(strip.children).forEach((button, i) => {
      button.setAttribute("aria-pressed", String(index === i));
    });
    if (strip.scrollWidth > strip.clientWidth) {
      const tile = strip.children[index];
      strip.scrollLeft = tile.offsetLeft - (strip.clientWidth - tile.offsetWidth) / 2;
    }
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
      showItem(index);
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
    stage.classList.remove("fn-enter", "fn-opening");
    strip.replaceChildren(...inventory.map(makeThumb));
    dialog.showModal();
    sound.currentTime = 0;
    sound.play().catch(() => {});
    purchaseTimer = setTimeout(() => {
      loader.hidden = true;
      stage.hidden = false;
      stage.classList.add("fn-opening");
      showItem(0, true);
      dialog.focus({ preventScroll: true });
    }, 510);
  };
})();
