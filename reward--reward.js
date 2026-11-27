(() => {
  "use strict";

  const scriptBase = new URL(".", document.currentScript.src);
  const resource = (file) => new URL("reward--" + file.replaceAll("/", "--"), scriptBase).href;
  const figureIds = new Set(["puss", "death", "sickles", "slippers", "stalking", "bounty"]);
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
      <video class="fn-plate" playsinline muted preload="auto" aria-hidden="true"></video>
      <div class="fn-heading"><h2>Items acquired</h2><p>Thanks for playing Fortnite!</p></div>
      <div class="fn-figure"><img alt=""><video class="fn-motion-source" playsinline muted loop preload="none" aria-hidden="true"></video></div>
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
  const movie = find(".fn-motion-source");
  const animatedImage = document.createElement("img");
  animatedImage.className = "fn-motion-image";
  animatedImage.alt = "";
  figure.append(animatedImage);
  let canvas = document.createElement("canvas");
  canvas.className = "fn-motion-canvas";
  canvas.setAttribute("aria-hidden", "true");
  figure.append(canvas);
  let painter;
  let pendingFrame;
  let expectedVideo = "";

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

  function stopMotion() {
    expectedVideo = "";
    figure.classList.remove("fn-moving", "fn-image-mode");
    animatedImage.onload = null;
    animatedImage.removeAttribute("src");
    movie.onplaying = null;
    movie.onerror = null;
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

  function playMotion(item, request) {
    stopMotion();
    if (!figureIds.has(item.id)) return;
    expectedVideo = resource("motion/" + item.id + ".mp4");
    let lastTime = -1;
    let imageFallback = false;
    function useAnimatedImage() {
      if (request !== playbackId || !active || imageFallback) return;
      imageFallback = true;
      stopMotion();
      animatedImage.onload = () => {
        if (request === playbackId && active) figure.classList.add("fn-moving", "fn-image-mode");
      };
      animatedImage.src = resource("motion/" + item.id + ".webp");
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
        try {
          if (!painter) painter = makeGpuPainter() || useSoftwarePainter();
          painter();
        } catch {
          try { painter = useSoftwarePainter(); painter(); }
          catch { useAnimatedImage(); return; }
        }
        lastTime = movie.currentTime;
        figure.classList.add("fn-moving");
      }
      pendingFrame = movie.requestVideoFrameCallback ? movie.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
    }
    movie.onerror = useAnimatedImage;
    movie.onplaying = () => { if (pendingFrame === undefined) draw(); };
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
    plate.pause();
    stopMotion();
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
    playMotion(item, request);
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
