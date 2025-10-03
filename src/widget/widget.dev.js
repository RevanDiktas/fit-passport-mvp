// src/widget/widget.dev.js
import { initViewer } from '../engine/viewer.js';
import { recommendSize } from '../engine/recommend.js';

const scriptEl = document.currentScript;
const merchant = scriptEl?.dataset?.merchant || 'demo';
const productId = scriptEl?.dataset?.productId || 'sku_demo';

// --- mount a shadow DOM panel (always visible) ---
const host = document.createElement('div');
host.style.all = 'initial';
host.style.position = 'fixed';
host.style.right = '16px';
host.style.bottom = '16px';
host.style.zIndex = '2147483647';
host.style.pointerEvents = 'auto';
document.body.appendChild(host);

const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `
  <style>
    :host{ all:initial }
    .panel{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans;
            background:#0e111a; color:#e6e6e6; border:1px solid #223;
            border-radius:14px; padding:12px; width:360px;
            box-shadow:0 12px 36px rgba(0,0,0,.5) }
    .row{ display:flex; align-items:center; gap:8px; margin:6px 0 }
    button{ background:#1e293b; color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer }
    button:hover{ filter:brightness(1.08) }
    canvas{ width:100%; height:360px; display:block; border-radius:8px; background:#000; margin-top:8px }
    .pill{ font-size:12px; opacity:.9 }
    .err{ background:#3a1e22; color:#ffd5db; padding:8px 10px; border-radius:8px; margin-top:8px; display:none; }
    .ok{ color:#9ae6b4 }
  </style>
  <div class="panel">
    <div class="row">
      <button id="open">Try on with Fit-Passport</button>
      <span id="pill" class="pill">Loading…</span>
    </div>
    <canvas id="c" width="640" height="360" aria-label="Fit-Passport viewer"></canvas>
    <div id="rec" class="pill"></div>
    <div id="err" class="err"></div>
  </div>
`;

const $ = (sel) => root.getElementById(sel);
const canvas = $('c');
const pill = $('pill');
const rec  = $('rec');
const err  = $('err');

// Helper to show errors inside the widget
function showError(message) {
  err.style.display = 'block';
  err.textContent = String(message || 'Unknown error');
  console.error('[Fit-Passport widget]', message);
}
function hideError() {
  err.style.display = 'none';
  err.textContent = '';
}

// --- boot sequence with defensive checks ---
(async function boot() {
  try {
    hideError();

    // 1) Fetch mock “API” data (served from /public/mock in dev)
    const [profile, garment] = await Promise.all([
      fetch('/mock/profile.json', { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('profile.json not found');
        return r.json();
      }),
      fetch('/mock/garment.json', { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('garment.json not found');
        return r.json();
      }),
    ]);

    pill.textContent = profile.user_id ? 'Signed in' : 'Guest';

    // 2) Init viewer + load avatar
    const viewer = await initViewer({ canvas });
    const avatarUrl = profile.avatar_url || '/avatar.glb';

    // Quick existence check for avatar.glb
    const ok = await fetch(avatarUrl, { method: 'HEAD', cache: 'no-store' }).then(r => r.ok).catch(() => false);
    if (!ok) throw new Error(`avatar GLB missing at ${avatarUrl}. Put your file in /public/avatar.glb`);

    await viewer.loadAvatar(avatarUrl);

    // 3) Compute recommendation
    const best = recommendSize({
      user: profile.measurements,
      sizeList: garment.sizes,
      fit_preference: 'regular'
    });

    rec.innerHTML = `Recommended: <b>${best.recommended}</b> <span class="ok">• ${best.label}</span>`;

    // 4) Dress the avatar with the chosen size
    const chosen = garment.sizes.find(s => s.size === best.recommended) || garment.sizes[0];
    await viewer.showTop({
      chest_cm: chosen.chest_cm,
      waist_cm: chosen.waist_cm,
      length_cm: chosen.length_cm,
      sleeve_len_cm: chosen.sleeve_len_cm,
      texture_url: garment.texture_front_url
    });

    // Done
    pill.textContent = 'Ready';
  } catch (e) {
    showError(e?.message || e);
    pill.textContent = 'Error';
  }
})();
