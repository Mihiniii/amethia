// Garment drawings used when a product has no photo yet.
// Shared by the shop (shop.js) and the admin panel (admin.js).
(function () {
  const GOLD = "#C9A646";
  function shape(type, c) {
    const L = 'stroke="var(--gline)" stroke-width="1.2" fill="none"';
    const S = 'stroke="var(--gline)" stroke-width="1"';
    switch (type) {
      case "maxi": return `<path ${S} fill="${c}" d="M78 10 Q100 28 122 10 L128 14 Q124 40 132 62 L130 86 Q148 170 162 254 Q100 262 38 254 Q52 170 70 86 L68 62 Q76 40 72 14 Z"/><path ${L} d="M66 120 Q100 128 134 120 M58 170 Q100 180 142 170 M48 214 Q100 226 152 214"/>`;
      case "slip": return `<path stroke="${c}" stroke-width="2" d="M84 8 L86 42 M116 8 L114 42"/><path ${S} fill="${c}" d="M80 40 Q100 54 120 40 Q128 70 122 100 Q134 180 142 250 Q100 258 58 250 Q66 180 78 100 Q72 70 80 40 Z"/><path ${L} d="M100 60 Q102 160 96 252"/>`;
      case "top": return `<path ${S} fill="${c}" d="M72 52 Q100 70 128 52 L162 72 L150 104 L134 96 L134 168 Q100 176 66 168 L66 96 L50 104 L38 72 Z"/><path ${L} d="M86 60 L116 150 M128 120 L140 150"/>`;
      case "blouse": return `<ellipse ${S} fill="${c}" cx="58" cy="86" rx="24" ry="30"/><ellipse ${S} fill="${c}" cx="142" cy="86" rx="24" ry="30"/><path ${S} fill="${c}" d="M74 52 Q100 66 126 52 L132 92 L130 182 Q100 190 70 182 L68 92 Z"/><path ${L} d="M100 62 L100 182"/><circle cx="100" cy="86" r="2.4" fill="${GOLD}"/><circle cx="100" cy="114" r="2.4" fill="${GOLD}"/><circle cx="100" cy="142" r="2.4" fill="${GOLD}"/>`;
      case "skirt": return `<path ${S} fill="${c}" d="M66 52 L134 52 L136 68 Q162 150 172 224 Q100 236 28 224 Q38 150 64 68 Z"/><rect x="66" y="44" width="68" height="14" fill="${GOLD}"/><path ${L} d="M82 70 L66 228 M94 70 L88 232 M106 70 L112 232 M118 70 L134 228"/>`;
      case "pants": return `<path ${S} fill="${c}" d="M66 34 L134 34 L138 52 L152 246 L112 246 L100 96 L88 246 L48 246 L62 52 Z"/><rect x="66" y="26" width="68" height="12" fill="${GOLD}"/><path ${L} d="M80 56 L72 240 M120 56 L128 240"/>`;
      case "coord": return `<g transform="translate(30 -20) scale(.7)">${shape("top", c)}</g><g transform="translate(30 98) scale(.62)">${shape("pants", c)}</g>`;
      default: return `<path ${S} fill="${c}" d="M78 14 Q100 30 122 14 L128 18 Q124 42 132 66 L130 92 Q160 170 176 246 Q100 258 24 246 Q40 170 70 92 L68 66 Q76 42 72 18 Z"/><path fill="${GOLD}" d="M70 92 Q100 102 130 92 L131 100 Q100 110 69 100 Z"/><path ${L} d="M100 106 Q96 180 86 250 M100 106 Q112 180 132 248"/>`;
    }
  }
  window.garment = function (type, color, view) {
    const inner = shape(type, color || "#6A2C91");
    const g = view === "detail" ? `<g transform="translate(-100 -40) scale(2)">${inner}</g>` : inner;
    return `<svg viewBox="0 0 200 260" aria-hidden="true">${g}</svg>`;
  };
})();
