(function() {
  'use strict';

  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const MAX_DPR = 2;
  const FRAME_MS = 1000 / 30;
  const SPEED = 0.6;            // world units per second
  const LINE_STEP = 1;          // spacing of grid lines (world units)
  const HALF_WIDTH = 7;         // lateral extent of the pitch
  const TOUCHLINE = 5;          // |x| of the touchlines
  const FAR = 30;               // far clip (world z)
  const NEAR = 0.6;             // near clip (world z)
  const PITCH_PERIOD = 10;      // distance between halfway line / center circle
  const CIRCLE_R = 2;
  const HORIZON = 0.34;         // horizon y as fraction of height

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let width = 0, height = 0, dpr = 1;
  let rgb = '57, 255, 136';
  let scroll = 0;
  let rafId = 0;
  let lastTs = 0;
  let lastDraw = 0;

  function readAccent() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) {
      const n = parseInt(m[1], 16);
      rgb = ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255);
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Perspective projection of ground-plane point (x, z) to screen.
  function project(x, z, f, cx, hy, camH) {
    return [cx + (f * x) / z, hy + (f * camH) / z];
  }

  function stroke(alpha, width_) {
    ctx.strokeStyle = 'rgba(' + rgb + ', ' + alpha.toFixed(3) + ')';
    ctx.lineWidth = width_;
    ctx.stroke();
  }

  function fade(z) {
    return Math.max(0, 1 - (z - NEAR) / (FAR - NEAR));
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const hy = height * HORIZON;
    const camH = 1.6;
    const f = Math.max(width, height * 0.9) * 0.55;

    ctx.lineCap = 'round';

    // Longitudinal lines (converge to the vanishing point).
    for (let x = -HALF_WIDTH; x <= HALF_WIDTH; x += LINE_STEP) {
      const touch = Math.abs(x) === TOUCHLINE;
      const [x0, y0] = project(x, NEAR, f, cx, hy, camH);
      const [x1, y1] = project(x, FAR, f, cx, hy, camH);
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      const a = touch ? 0.38 : 0.12;
      g.addColorStop(0, 'rgba(' + rgb + ', ' + a + ')');
      g.addColorStop(1, 'rgba(' + rgb + ', 0)');
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = g;
      ctx.lineWidth = touch ? 1.6 : 1;
      ctx.stroke();
    }

    // Transverse lines, scrolling toward the camera.
    const offset = scroll % LINE_STEP;
    for (let z = FAR - offset; z > NEAR; z -= LINE_STEP) {
      const [xl, y] = project(-HALF_WIDTH, z, f, cx, hy, camH);
      const [xr] = project(HALF_WIDTH, z, f, cx, hy, camH);
      ctx.beginPath();
      ctx.moveTo(xl, y);
      ctx.lineTo(xr, y);
      stroke(0.14 * fade(z), 1);
    }

    // Halfway line + center circle, repeating every PITCH_PERIOD.
    const phase = scroll % PITCH_PERIOD;
    for (let zc = FAR - phase; zc > NEAR + CIRCLE_R; zc -= PITCH_PERIOD) {
      const k = fade(zc);
      if (k <= 0) continue;

      const [hl, hyy] = project(-TOUCHLINE, zc, f, cx, hy, camH);
      const [hr] = project(TOUCHLINE, zc, f, cx, hy, camH);
      ctx.beginPath();
      ctx.moveTo(hl, hyy);
      ctx.lineTo(hr, hyy);
      stroke(0.4 * k, 1.6);

      ctx.beginPath();
      const STEPS = 48;
      for (let i = 0; i <= STEPS; i++) {
        const t = (i / STEPS) * Math.PI * 2;
        const z = zc + Math.sin(t) * CIRCLE_R;
        if (z <= NEAR) continue;
        const [px, py] = project(Math.cos(t) * CIRCLE_R, z, f, cx, hy, camH);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      stroke(0.4 * k, 1.6);
    }
  }

  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    if (ts - lastDraw < FRAME_MS) return;
    lastDraw = ts;
    if (lastTs) scroll += ((ts - lastTs) / 1000) * SPEED;
    lastTs = ts;
    draw();
  }

  function shouldAnimate() {
    return !document.hidden && !reducedQuery.matches;
  }

  function start() {
    if (rafId || !shouldAnimate()) return;
    lastTs = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function sync() {
    stop();
    if (shouldAnimate()) start();
    else draw();
  }

  let resizePending = false;
  window.addEventListener('resize', () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      resize();
      if (!rafId) draw();
    });
  });

  document.addEventListener('visibilitychange', sync);
  if (reducedQuery.addEventListener) reducedQuery.addEventListener('change', sync);

  readAccent();
  resize();
  scroll = 3; // pleasant static composition for reduced motion
  sync();
})();
