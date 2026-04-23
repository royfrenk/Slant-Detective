// ---------------------------------------------------------------------------
// reload-banner.ts — SD-058
// Renders a bottom-right toast when the extension context has been invalidated.
// MUST NOT call any chrome.* API — the runtime is dead when this runs.
// Uses its own Shadow DOM host so tooltip.ts is not imported or coupled.
// ---------------------------------------------------------------------------

const BANNER_HOST_ID = 'sd-reload-banner-host';
const BANNER_ELEMENT_ID = 'sd-reload-banner';

export function showReloadBanner(): void {
  // If a banner host already exists, a banner was already shown — no-op.
  if (document.getElementById(BANNER_HOST_ID) !== null) return;

  // Create a dedicated shadow DOM host for the banner.
  const hostEl = document.createElement('div');
  hostEl.id = BANNER_HOST_ID;
  hostEl.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;';

  const shadowRoot = hostEl.attachShadow({ mode: 'open' });
  document.body.appendChild(hostEl);

  const banner = document.createElement('div');
  banner.id = BANNER_ELEMENT_ID;
  banner.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'padding:12px 16px',
    'border-radius:8px',
    'background:rgba(247,249,251,0.92)',
    'backdrop-filter:blur(16px)',
    '-webkit-backdrop-filter:blur(16px)',
    'box-shadow:0 2px 12px rgba(0,0,0,0.15)',
    'font-family:system-ui,sans-serif',
    'font-size:14px',
    'color:#1a1a2e',
    'pointer-events:auto',
  ].join(';');

  const messageSpan = document.createElement('span');
  messageSpan.textContent =
    'Slant Detective was updated. Reload this tab to continue.';

  const reloadBtn = document.createElement('button');
  reloadBtn.textContent = 'Reload';
  reloadBtn.style.cssText = [
    'margin-left:8px',
    'padding:4px 10px',
    'border-radius:4px',
    'border:none',
    'background:#2563eb',
    'color:#fff',
    'cursor:pointer',
    'font-size:13px',
  ].join(';');
  reloadBtn.addEventListener('click', () => {
    window.location.reload();
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.textContent = 'x';
  dismissBtn.setAttribute('aria-label', 'Dismiss');
  dismissBtn.style.cssText = [
    'background:none',
    'border:none',
    'cursor:pointer',
    'font-size:16px',
    'color:#666',
    'padding:0 0 0 4px',
    'line-height:1',
  ].join(';');
  dismissBtn.addEventListener('click', () => {
    banner.remove();
    hostEl.remove();
  });

  banner.appendChild(messageSpan);
  banner.appendChild(reloadBtn);
  banner.appendChild(dismissBtn);
  shadowRoot.appendChild(banner);
}
