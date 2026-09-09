// Shared DOM helpers for the live delivery map markers.
// All icons are pure inline SVG — zero external assets, zero API keys.

/**
 * Zepto/Swiggy-style side-view delivery scooter SVG.
 * Rider + helmet + scooter body, rendered at 48×48.
 */
export const MOTO_SVG_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 64 48" aria-hidden="true">' +
  // Shadow
  '<ellipse cx="32" cy="45" rx="22" ry="3" fill="rgba(0,0,0,0.15)"/>' +
  // Rear wheel
  '<circle cx="10" cy="36" r="8" fill="none" stroke="#1a1a1a" stroke-width="3"/>' +
  '<circle cx="10" cy="36" r="4.5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>' +
  '<circle cx="10" cy="36" r="1.5" fill="#1a1a1a"/>' +
  // Front wheel
  '<circle cx="52" cy="36" r="8" fill="none" stroke="#1a1a1a" stroke-width="3"/>' +
  '<circle cx="52" cy="36" r="4.5" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>' +
  '<circle cx="52" cy="36" r="1.5" fill="#1a1a1a"/>' +
  // Frame / body
  '<path d="M10 36 L20 20 L36 20 L48 28 L52 36" stroke="#1e40af" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  // Engine / belly
  '<path d="M18 28 Q28 34 40 30 L44 36 L14 36 Z" fill="#2563eb" opacity="0.9"/>' +
  // Seat / body top
  '<path d="M22 20 Q28 16 36 18 L40 22 L22 22 Z" fill="#1d4ed8"/>' +
  // Delivery box on back
  '<rect x="6" y="14" width="18" height="12" rx="2" fill="#0ea5e9" stroke="#0284c7" stroke-width="1"/>' +
  '<text x="15" y="23" font-size="5.5" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">OOR</text>' +
  // Rider body
  '<ellipse cx="30" cy="19" rx="5" ry="7" fill="#374151"/>' +
  // Rider arm
  '<path d="M30 22 Q40 24 44 26" stroke="#374151" stroke-width="3" stroke-linecap="round" fill="none"/>' +
  // Handlebar
  '<path d="M44 26 L50 24" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round"/>' +
  // Helmet
  '<circle cx="30" cy="12" r="7" fill="#065f46"/>' +
  '<path d="M24 12 Q26 6 36 9" stroke="#10b981" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
  // Visor
  '<path d="M25 14 Q30 17 35 14" stroke="#34d399" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
  // Headlight
  '<ellipse cx="56" cy="29" rx="3" ry="2" fill="#fef08a" opacity="0.9"/>' +
  '</svg>';

/** Creates the bike marker element with a pulsing ring + real scooter icon. */
export function bikeBadgeElement(heading: number): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'ltm-bike-badge';

  // Pulsing ring (Zepto-style)
  const pulse = document.createElement('div');
  pulse.className = 'ltm-bike-pulse';
  wrapper.appendChild(pulse);

  // Icon container (rotates with heading)
  const glyph = document.createElement('div');
  glyph.className = 'ltm-bike-glyph';
  glyph.style.transform = `rotate(${heading}deg)`;
  glyph.innerHTML = MOTO_SVG_MARKUP;
  wrapper.appendChild(glyph);

  return wrapper;
}

export function bikeBadgeIcon(heading: number): HTMLDivElement {
  return bikeBadgeElement(heading);
}

/** Red destination pin (customer address). */
export function destPinElement(label?: string): HTMLDivElement {
  const pin = document.createElement('div');
  pin.className = 'ltm-dest-pin';
  pin.innerHTML =
    '<div class="ltm-dest-head"><div class="ltm-dest-dot"></div></div>' +
    '<div class="ltm-dest-tail"></div>';
  if (label) pin.title = label;
  return pin;
}

export function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return !!gl;
  } catch {
    return false;
  }
}

// OpenStreetMap tiles — 100% free, no API key, no sign-up required.
export const CARTO_RASTER_TILE =
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const CARTO_RASTER_SUBDOMAINS = ['a', 'b', 'c'];
export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';