// Shared DOM helpers for the live delivery map markers, so both the
// maplibre-gl (WebGL) and the Leaflet (no-WebGL) renderers draw the same
// bike badge and destination pin. No React refs live inside these nodes.

export const MOTO_SVG_MARKUP =
  '<svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
  '<path d="M8.5 30.5 L13.5 22.5 H22.5" stroke="#141414" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '<rect x="14.5" y="20.8" width="8.2" height="5" rx="1.4" fill="#141414" opacity="0.9"/>' +
  '<path d="M11.5 21.2 Q13 17.5 16.5 17.2 H21.5 Q24 17.4 25.2 19.6" stroke="#141414" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '<path d="M22.5 20.5 L28.5 12.8" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/>' +
  '<path d="M25.2 11.6 L30.5 12.4" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/>' +
  '<circle cx="31" cy="13.6" r="1.7" fill="#141414"/>' +
  '<path d="M14.5 25.6 L11 29.5" stroke="#141414" stroke-width="2" stroke-linecap="round"/>' +
  '<circle cx="9" cy="29.5" r="4.6" fill="none" stroke="#141414" stroke-width="2.6"/><circle cx="9" cy="29.5" r="1.2" fill="#141414"/>' +
  '<circle cx="29" cy="29.5" r="4.6" fill="none" stroke="#141414" stroke-width="2.6"/><circle cx="29" cy="29.5" r="1.2" fill="#141414"/>' +
  '<circle cx="9" cy="29.5" r="2.6" fill="none" stroke="#141414" stroke-width="0.7" opacity="0.6"/>' +
  '<circle cx="29" cy="29.5" r="2.6" fill="none" stroke="#141414" stroke-width="0.7" opacity="0.6"/>' +
  '</svg>';

export function bikeBadgeElement(heading: number): HTMLDivElement {
  const badge = document.createElement('div');
  badge.className = 'ltm-bike-badge';
  const glyph = document.createElement('div');
  glyph.className = 'ltm-bike-glyph';
  glyph.style.transform = `rotate(${heading}deg)`;
  const wrap = document.createElement('div');
  wrap.innerHTML = MOTO_SVG_MARKUP;
  glyph.appendChild(wrap.firstElementChild as SVGElement);
  badge.appendChild(glyph);
  return badge;
}

export function bikeBadgeIcon(heading: number): HTMLDivElement {
  return bikeBadgeElement(heading);
}

export function destPinElement(label?: string): HTMLDivElement {
  const pin = document.createElement('div');
  pin.className = 'ltm-dest-pin';
  pin.innerHTML =
    '<div class="ltm-dest-head"><div class="ltm-dest-dot"></div></div><div class="ltm-dest-tail"></div>';
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

/** Free raster tile template for the no-WebGL Leaflet fallback (CARTO basemaps, no API key). */
export const CARTO_RASTER_TILE =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
export const CARTO_RASTER_SUBDOMAINS = ['a', 'b', 'c', 'd'];
export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';