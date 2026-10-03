/* Amethia storefront.
   Pages use the part of the address after "#": #shop, #shop-dresses, #p-iris-dress, #about, #help, #checkout.
   Order confirmation pages use a real path: /order/AM1001/<key>  (PayHere sends customers back here). */

const CATS = {
  all: { name: "Shop all", blurb: "Every Amethia piece, designed in Sri Lanka and made to order." },
  dresses: { name: "Dresses", blurb: "From our first A-line midi to floor-length maxis." },
  tops: { name: "Tops", blurb: "Easy tops and blouses to pair with everything else." },
  bottoms: { name: "Skirts & pants", blurb: "Pleats, wide legs and comfortable waistbands." },
  coords: { name: "Co-ord sets", blurb: "Matching pieces that work together or apart." },
};
const SIZE_CHART = [["XS", 32, 26, 35], ["S", 34, 28, 37], ["M", 36, 30, 39], ["L", 38, 32, 41], ["XL", 40, 34, 43], ["XXL", 42, 36, 45]];

let STORE = {}, PRODUCTS = [], CARD_PAYMENTS = false;

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const lkr = n => "LKR " + Number(n).toLocaleString("en-US");
const byId = id => PRODUCTS.find(p => p.id === id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const waLink = text => `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;
const prettyPhone = () => "+" + String(STORE.whatsapp || "").replace(/^(\d{2})(\d{2})(\d{3})(\d+)$/, "$1 $2 $3 $4");
const deliveryFee = () => Number(STORE.delivery_fee) || 0;
const freeOver = () => Number(STORE.free_delivery_over) || 0;

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: opts.body ? { "Content-Type": "application/json" } : {}, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function pic(p, opts = {}) {
  const idx = opts.index || 0;
  if (p.images && p.images.length) {
    const id = p.images[Math.min(idx, p.images.length - 1)];
    return `<img src="/api/images/${id}" alt="${esc(p.name)}" ${opts.eager ? "" : 'loading="lazy"'}>`;
  }
  const color = (p.colors[opts.color || 0] || p.colors[0] || [])[1];
  return garment(p.type, color, opts.view);
}

/* ---------- bag (saved in this browser) ---------- */
let bag = [];
function loadBag() {
  try { bag = JSON.parse(localStorage.getItem("amethia-bag") || "[]"); } catch (e) { bag = []; }
  bag = bag.filter(l => { const p = byId(l.id); return p && !p.soldOut && p.sizes.includes(l.size) && sizeLeft(p, l.size) > 0 && p.colors.some(c => c[0] === l.color); });
}
// Pieces left in a size, or Infinity when the size is made to order. The server has the final say at checkout.
const sizeLeft = (p, size) => p.soldOut ? 0 : size in p.stock ? p.stock[size] : Infinity;
const maxQty = (p, size) => Math.min(10, sizeLeft(p, size));
function saveBag() { try { localStorage.setItem("amethia-bag", JSON.stringify(bag)); } catch (e) {} updateCount(); }
function updateCount() { $("#bagcount").textContent = bag.reduce((a, l) => a + l.qty, 0); }
const subtotal = () => bag.reduce((a, l) => a + byId(l.id).price * l.qty, 0);
function delivery() { const s = subtotal(); return s === 0 || (freeOver() > 0 && s >= freeOver()) ? 0 : deliveryFee(); }

/* ---------- shared pieces ---------- */
function card(p) {
  return `<a class="card" href="#p-${p.id}">
    <div class="pimg">${pic(p)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}${p.soldOut ? `<span class="soldout">Sold out</span>` : ""}</div>
    <div class="meta"><h3>${esc(p.name)}</h3><span class="price">${lkr(p.price)}</span></div>
    <div class="dots">${p.colors.map(c => `<span class="dot" style="background:${esc(c[1])}" title="${esc(c[0])}"></span>`).join("")}</div>
  </a>`;
}
function sizeTable() {
  return `<div class="tbl-wrap"><table><thead><tr><th>Size</th><th>Bust (in)</th><th>Waist (in)</th><th>Hip (in)</th></tr></thead><tbody>
  ${SIZE_CHART.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}</tbody></table></div>`;
}
const deliveryText = () => `<p>Every piece is made to order and ready in 7–10 days. Delivery then takes 2–3 working days in Colombo and suburbs, and 3–5 working days elsewhere in Sri Lanka.</p><p>Delivery is ${lkr(deliveryFee())}${freeOver() ? `, free on orders over ${lkr(freeOver())}` : ""}. Pay securely by card online${STORE.cod_enabled === "1" ? ", or with cash on delivery" : ""}.</p>`;
const EXCHANGE_TEXT = `<p>If the size isn't right, message us within 7 days of delivery and we'll exchange it. Pieces must be unworn, unwashed and have their tags on. As every piece is made to order, we offer exchanges rather than refunds.</p>`;

/* ---------- pages ---------- */
function home() {
  const hero = PRODUCTS[0];
  const pick = cat => PRODUCTS.find(p => p.category === cat);
  const cats = Object.keys(CATS).filter(k => k !== "all" && pick(k));
  return `
  <section class="hero"><div class="wrap hero-in">
    <div>
      <p class="eyebrow">Collection 01 · The Beginning</p>
      <h1>Made in <em>purple</em>, made for you</h1>
      <p class="lede">Amethia is a new clothing label from Sri Lanka. Every piece is designed in-house and made to order in small runs${hero ? `, starting with the ${esc(hero.name)}` : ""}.</p>
      <div class="hero-btns"><a class="btn primary" href="#shop">Shop the collection</a>${hero ? `<a class="btn ghost" href="#p-${hero.id}">See the ${esc(hero.name)}</a>` : ""}</div>
    </div>
    <div class="hero-art">
      <div class="arch">${hero ? pic(hero, { eager: true }) : garment("dress", "#6A2C91")}</div>
      <div class="arch">${PRODUCTS[1] ? pic(PRODUCTS[1], { eager: true }) : garment("maxi", "#B48AD6")}</div>
    </div>
  </div></section>

  <div class="perks">
    <div class="perk"><b>Made to order</b><span class="muted">Ready in 7–10 days</span></div>
    <div class="perk"><b>Island-wide delivery</b><span class="muted">${freeOver() ? `Free over ${lkr(freeOver())}` : "Across Sri Lanka"}</span></div>
    <div class="perk"><b>Secure payment</b><span class="muted">Card online${STORE.cod_enabled === "1" ? " or cash on delivery" : ""}</span></div>
  </div>

  ${cats.length ? `<section class="sec"><div class="wrap">
    <div class="sec-head"><h2>Shop by category</h2></div>
    <div class="cats">${cats.map(k => `<a class="cat" href="#shop-${k}"><div class="pimg">${pic(pick(k))}</div><span>${CATS[k].name}<span aria-hidden="true">→</span></span></a>`).join("")}</div>
  </div></section>` : ""}

  <section class="sec" style="padding-top:${cats.length ? 0 : 72}px"><div class="wrap">
    <div class="sec-head"><h2>New arrivals</h2><a class="link" href="#shop">View all</a></div>
    <div class="grid">${PRODUCTS.slice(0, 4).map(card).join("")}</div>
  </div></section>

  ${hero ? `<section class="sec" style="padding-top:0"><div class="wrap spot">
    <div class="pimg">${pic(hero)}</div>
    <div>
      <p class="eyebrow">Where it started</p>
      <h2>The ${esc(hero.name)}</h2>
      <p>${esc(hero.intro)} ${esc(hero.description)}</p>
      <a class="btn primary" href="#p-${hero.id}">Shop now · ${lkr(hero.price)}</a>
    </div>
  </div></section>` : ""}

  <section class="story"><div class="wrap">
    <p class="eyebrow">From the designer</p>
    <blockquote>“I sketched the Iris Dress long before I had a name for the label. Amethia is where my ideas finally leave the notebook. This is the first collection, and many more designs are on the way.”</blockquote>
    <a class="link" href="#about">Read our story</a>
  </div></section>

  ${STORE.instagram ? `<section class="sec"><div class="wrap">
    <div class="sec-head"><div><p class="eyebrow">On Instagram</p><h2>@${esc(STORE.instagram)}</h2></div><a class="btn ghost js-ig" href="#">Follow us</a></div>
    <div class="ig">${PRODUCTS.slice(0, 6).map(p => `<a class="js-ig" href="#" aria-label="Amethia on Instagram">${pic(p, { index: 1, color: p.colors.length - 1 })}</a>`).join("")}</div>
  </div></section>` : ""}`;
}

let sortBy = "featured";
function shop(cat) {
  const c = CATS[cat] ? cat : "all";
  let list = PRODUCTS.filter(p => c === "all" || p.category === c);
  if (sortBy === "low") list = [...list].sort((a, b) => a.price - b.price);
  if (sortBy === "high") list = [...list].sort((a, b) => b.price - a.price);
  return `
  <div class="wrap pagehead"><h1>${CATS[c].name}</h1><p>${CATS[c].blurb}</p></div>
  <div class="wrap">
    <div class="toolbar">
      <div class="chips">${Object.keys(CATS).map(k => `<a class="chip ${k === c ? "on" : ""}" href="#${k === "all" ? "shop" : "shop-" + k}">${k === "all" ? "All" : CATS[k].name}</a>`).join("")}</div>
      <label class="sort" for="sort">${list.length} ${list.length === 1 ? "piece" : "pieces"} · Sort
        <select id="sort" data-action="sort">
          <option value="featured" ${sortBy === "featured" ? "selected" : ""}>Featured</option>
          <option value="low" ${sortBy === "low" ? "selected" : ""}>Price, low to high</option>
          <option value="high" ${sortBy === "high" ? "selected" : ""}>Price, high to low</option>
        </select></label>
    </div>
    ${list.length ? `<div class="grid" style="padding-bottom:72px">${list.map(card).join("")}</div>`
      : `<div class="empty"><p>New pieces for this category are coming soon.</p><a class="btn ghost" href="#shop">See everything</a></div>`}
  </div>`;
}

let pdp = { id: null, color: 0, size: null, qty: 1, view: 0, err: "" };
function product(id) {
  const p = byId(id);
  if (!p) return `<div class="wrap empty" style="padding-block:120px"><p>We couldn't find that piece. It may have sold out.</p><a class="btn primary" href="#shop">Back to the shop</a></div>`;
  if (pdp.id !== id) pdp = { id, color: 0, size: p.sizes.length === 1 && sizeLeft(p, p.sizes[0]) > 0 ? p.sizes[0] : null, qty: 1, view: 0, err: "" };
  const left = pdp.size ? sizeLeft(p, pdp.size) : Infinity;
  const [cname] = p.colors[pdp.color];
  const ask = waLink(`Hi Amethia! I have a question about the ${p.name} (${cname}).`);
  const more = PRODUCTS.filter(x => x.id !== id).sort((a, b) => (b.category === p.category) - (a.category === p.category)).slice(0, 4);
  const views = p.images.length ? p.images.map((_, i) => ({ i, label: `Photo ${i + 1}` })) : [{ i: 0, label: "Full view" }, { i: 1, label: "Close-up" }];
  const mainPic = p.images.length ? pic(p, { index: pdp.view, eager: true }) : garment(p.type, p.colors[pdp.color][1], pdp.view === 1 ? "detail" : "front");
  return `
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#home">Home</a><span>/</span><a href="#shop-${p.category}">${CATS[p.category].name}</a><span>/</span><span>${esc(p.name)}</span></nav>
    <div class="pdp">
      <div class="gallery">
        <div class="thumbs">
          ${views.map(v => `<button class="thumb" id="th-${v.i}" data-action="view" data-v="${v.i}" aria-pressed="${pdp.view === v.i}" aria-label="${v.label}">${p.images.length ? pic(p, { index: v.i }) : garment(p.type, p.colors[pdp.color][1], v.i === 1 ? "detail" : "front")}</button>`).join("")}
        </div>
        <div class="pimg main">${mainPic}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}</div>
      </div>
      <div class="pinfo">
        <h1>${esc(p.name)}</h1>
        <p class="pprice">${lkr(p.price)}</p>
        <p class="intro">${esc(p.intro)}</p>
        <div class="opt">
          <span class="optlabel">Colour <b>${esc(cname)}</b></span>
          <div class="swatches">${p.colors.map((c, i) => `<button class="sw" id="sw-${i}" style="background:${esc(c[1])}" data-action="color" data-i="${i}" aria-pressed="${i === pdp.color}" aria-label="${esc(c[0])}"></button>`).join("")}</div>
        </div>
        <div class="opt">
          <span class="optlabel">Size <b>${pdp.size || "Select a size"}</b></span>
          <div class="sizes">${p.sizes.map(s => `<button class="sz" id="sz-${s.replace(/\s/g, "")}" data-action="size" data-s="${esc(s)}" aria-pressed="${pdp.size === s}" ${sizeLeft(p, s) > 0 ? "" : `disabled aria-label="${esc(s)}, sold out" title="Sold out"`}>${esc(s)}</button>`).join("")}</div>
          ${!p.soldOut && left <= 3 ? `<p class="muted" style="margin:0;font-size:14px">Only ${left} left in this size.</p>` : ""}
          ${pdp.err ?`<p class="err" role="alert">${esc(pdp.err)}</p>` : ""}
        </div>
        <div class="actions">
          ${p.soldOut ? `<button class="btn primary block" disabled>Sold out</button>` : `
          <div class="qtyrow">
            <div class="qty" aria-label="Quantity"><button id="q-minus" data-action="pqty" data-d="-1" aria-label="Fewer">−</button><span>${pdp.qty}</span><button id="q-plus" data-action="pqty" data-d="1" aria-label="More">+</button></div>
            <button class="btn primary" id="addbtn" data-action="add">Add to bag · ${lkr(p.price * pdp.qty)}</button>
          </div>`}
          <a class="btn ghost block" href="${ask}" target="_blank" rel="noopener">Ask a question on WhatsApp</a>
        </div>
        <div style="margin-top:28px">
          <details open><summary>Description</summary><div><p>${esc(p.intro)} ${esc(p.description)}</p></div></details>
          ${p.fabric ? `<details><summary>Fabric &amp; care</summary><div><p>${esc(p.fabric)}</p></div></details>` : ""}
          <details><summary>Size guide</summary><div><p>Body measurements in inches. Between sizes? Choose the larger one, or message us and we'll help.</p>${sizeTable()}</div></details>
          <details><summary>Delivery &amp; exchanges</summary><div>${deliveryText()}${EXCHANGE_TEXT}</div></details>
        </div>
      </div>
    </div>
  </div>
  ${more.length ? `<section class="sec" style="border-top:1px solid var(--line)"><div class="wrap">
    <div class="sec-head"><h2>You may also like</h2></div>
    <div class="grid">${more.map(card).join("")}</div>
  </div></section>` : ""}`;
}

function about() {
  const hero = PRODUCTS[0];
  return `
  <div class="wrap pagehead"><p class="eyebrow">Our story</p><h1>Ideas that left the notebook</h1></div>
  <div class="wrap sec">
    <div class="twocol">
      <div class="pimg" style="aspect-ratio:4/5">${hero ? pic(hero) : garment("dress", "#6A2C91")}</div>
      <div class="prose">
        <p>Amethia started with one sketch: an A-line dress in a deep amethyst purple. It became the Iris Dress, our first design, and the beginning of the label.</p>
        <p>The name comes from amethyst, the purple stone. Purple runs through every collection, from soft lilac to deep plum, alongside small touches of gold.</p>
        <p>Every piece is designed here in Sri Lanka and made to order in small runs. Making each order as it comes in means less waste, and more care in every seam.</p>
        <div class="values">
          <div><h3>Designed here</h3><p>Every piece is sketched, sampled and fitted in Sri Lanka.</p></div>
          <div><h3>Small runs</h3><p>We make to order, so nothing sits unsold in a warehouse.</p></div>
          <div><h3>Made to last</h3><p>Breathable fabrics and careful finishing, chosen for our climate.</p></div>
        </div>
      </div>
    </div>
  </div>`;
}

function help() {
  const faq = [
    ["How do I place an order?", "Choose your size and colour, add the piece to your bag and go to checkout. Pay securely by card through PayHere" + (STORE.cod_enabled === "1" ? ", or choose cash on delivery" : "") + ". You'll get an order number straight away."],
    ["How long does delivery take?", "Every piece is made to order and ready in 7–10 days. Delivery then takes 2–3 working days in Colombo and suburbs, and 3–5 working days elsewhere."],
    ["Which cards can I use?", "Visa, Mastercard and American Express, plus mobile wallets supported by PayHere. Card details are entered on PayHere's secure page; we never see your card number."],
    ["Can I exchange a size?", "Yes. Message us within 7 days of delivery. The piece must be unworn, unwashed and still have its tags."],
    ["Do you make custom sizes?", "Message us on WhatsApp with your measurements and we'll let you know what's possible for that design."],
  ];
  return `
  <div class="wrap pagehead"><p class="eyebrow">Help</p><h1>Questions, sizes &amp; contact</h1></div>
  <div class="wrap sec">
    <div class="contacts">
      <div><span class="lbl">WhatsApp</span><b>${prettyPhone()}</b><a class="link" style="justify-self:start" href="${waLink("Hi Amethia!")}" target="_blank" rel="noopener">Open chat</a></div>
      <div><span class="lbl">Instagram</span><b>@${esc(STORE.instagram)}</b><a class="link js-ig" style="justify-self:start" href="#">Visit profile</a></div>
      <div><span class="lbl">Email</span><b>${esc(STORE.email)}</b><a class="link" style="justify-self:start" href="mailto:${esc(STORE.email)}">Send an email</a></div>
    </div>
    <div class="twocol">
      <div><h2 style="font-size:36px">Size guide</h2><p class="muted">Body measurements in inches. If you're between sizes, choose the larger one or message us.</p></div>
      <div>${sizeTable()}</div>
    </div>
    <div class="twocol" style="margin-top:64px">
      <div><h2 style="font-size:36px">FAQ</h2></div>
      <div>${faq.map(([q, a], i) => `<details ${i === 0 ? "open" : ""}><summary>${q}</summary><div><p>${a}</p></div></details>`).join("")}</div>
    </div>
  </div>`;
}

function summaryBox() {
  const lines = bag.map(l => { const p = byId(l.id); return `<div class="sumline"><span>${l.qty} × ${esc(p.name)}<br><span class="muted" style="font-size:13px">${esc(l.color)} · ${esc(l.size)}</span></span><span>${lkr(p.price * l.qty)}</span></div>`; }).join("");
  return `<aside class="summary">
      <h2>Order summary</h2>${lines}
      <div class="totals">
        <div><span>Subtotal</span><span>${lkr(subtotal())}</span></div>
        <div><span>Delivery</span><span>${delivery() === 0 ? "Free" : lkr(delivery())}</span></div>
        <div class="grand"><span>Total</span><span>${lkr(subtotal() + delivery())}</span></div>
      </div>
    </aside>`;
}

let coDraft = {}, coError = "", coBusy = false;
function checkout() {
  if (!bag.length) return `<div class="wrap pagehead"><h1>Checkout</h1></div><div class="wrap"><div class="empty"><p>Your bag is empty.</p><a class="btn primary" href="#shop">Start shopping</a></div></div>`;
  const cod = STORE.cod_enabled === "1";
  const methods = [];
  if (CARD_PAYMENTS) methods.push(["card", "Pay online by card", "Visa, Mastercard, Amex and mobile wallets through PayHere's secure page.", true]);
  if (cod) methods.push(["cod", "Cash on delivery", "Pay the courier when your order arrives."]);
  const chosen = coDraft.paymentMethod && methods.some(m => m[0] === coDraft.paymentMethod) ? coDraft.paymentMethod : (methods[0] || [])[0];
  const v = k => esc(coDraft[k] || "");
  return `
  <div class="wrap pagehead"><h1>Checkout</h1><p>Enter your delivery details and choose how you'd like to pay.</p></div>
  <div class="wrap co">
    <form class="form" id="coform" novalidate>
      <h2>Contact</h2>
      <div class="row2">
        <div class="field"><label for="f-first">First name</label><input type="text" id="f-first" name="firstName" required autocomplete="given-name" value="${v("firstName")}"></div>
        <div class="field"><label for="f-last">Last name</label><input type="text" id="f-last" name="lastName" required autocomplete="family-name" value="${v("lastName")}"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="f-email">Email</label><input type="email" id="f-email" name="email" required autocomplete="email" value="${v("email")}"></div>
        <div class="field"><label for="f-phone">Phone number</label><input type="tel" id="f-phone" name="phone" required autocomplete="tel" placeholder="07X XXX XXXX" value="${v("phone")}"></div>
      </div>
      <h2 style="margin-top:8px">Delivery address</h2>
      <div class="field"><label for="f-addr">Address</label><input type="text" id="f-addr" name="address" required autocomplete="street-address" value="${v("address")}"></div>
      <div class="row2">
        <div class="field"><label for="f-city">City</label><input type="text" id="f-city" name="city" required autocomplete="address-level2" value="${v("city")}"></div>
        <div class="field"><label for="f-dist">District</label><input type="text" id="f-dist" name="district" value="${v("district")}"></div>
      </div>
      <div class="field"><label for="f-notes">Notes (optional)</label><textarea id="f-notes" name="notes" rows="3" placeholder="Delivery instructions or a gift message">${v("notes")}</textarea></div>
      <fieldset class="fieldset"><legend>Payment</legend>
        ${methods.length ? methods.map(m => `<label class="radio"><input type="radio" name="paymentMethod" id="pay-${m[0]}" value="${m[0]}" ${m[0] === chosen ? "checked" : ""}><span>${m[1]}<small>${m[2]}</small>${m[3] ? `<span class="paybadges"><span>VISA</span><span>MASTERCARD</span><span>AMEX</span><span>eZ CASH</span><span>GENIE</span></span>` : ""}</span></label>`).join("")
          : `<p class="alert">Online ordering is paused right now. Please message us on WhatsApp at ${prettyPhone()}.</p>`}
      </fieldset>
      ${coError ? `<p class="alert" role="alert">${esc(coError)}</p>` : ""}
      <button class="btn primary block" type="submit" ${coBusy || !methods.length ? "disabled" : ""}>${coBusy ? "Placing your order…" : chosen === "card" ? `Pay ${lkr(subtotal() + delivery())} securely` : "Place order"}</button>
      ${chosen === "card" ? `<p class="muted" style="font-size:13.5px;margin:0">You'll be taken to PayHere to pay. Card details are never stored on this website.</p>` : ""}
    </form>
    ${summaryBox()}
  </div>`;
}

function goToPayHere(ph) {
  const f = document.createElement("form");
  f.method = "POST"; f.action = ph.action;
  for (const [k, val] of Object.entries(ph.fields)) {
    const i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = val; f.appendChild(i);
  }
  document.body.appendChild(f); f.submit();
}

/* ---------- order status page (/order/AM1001/key) ---------- */
let orderPoll = null;
async function orderPage(no, key, cancelled) {
  const app = $("#app");
  let o;
  try { o = await api(`/api/orders/${encodeURIComponent(no)}?key=${encodeURIComponent(key)}`); }
  catch (e) { app.innerHTML = `<div class="wrap orderbox"><h1>Order not found</h1><p class="lead">${esc(e.message)} If you need help, message us on WhatsApp at ${prettyPhone()}.</p><a class="btn primary" href="/#shop">Back to the shop</a></div>`; return; }

  const isCard = o.paymentMethod === "card";
  const st = o.paymentStatus;
  let title, lead, extra = "";
  if (o.status === "cancelled") { title = "This order was cancelled"; lead = `If you have questions, message us on WhatsApp at ${prettyPhone()}.`; }
  else if (!isCard) { title = `Thank you, ${esc(o.firstName)}!`; lead = `Your order <b>${o.orderNo}</b> is placed. Please keep ${lkr(o.total)} ready for the courier. We'll message you when it's on the way.`; }
  else if (st === "paid") { title = `Thank you, ${esc(o.firstName)}!`; lead = `We've received your payment of ${lkr(o.total)}. Your order number is <b>${o.orderNo}</b>. We'll message you when it's on the way.`; }
  else if (st === "pending" && !cancelled) { title = "Confirming your payment"; lead = `<span class="spinner"></span>We're waiting for PayHere to confirm your payment for order <b>${o.orderNo}</b>. This usually takes a few seconds.`; }
  else {
    title = cancelled || st === "cancelled" ? "Payment not completed" : "Payment didn't go through";
    lead = `Your order <b>${o.orderNo}</b> is saved, but it hasn't been paid yet. You can try again now, or message us on WhatsApp at ${prettyPhone()}.`;
    extra = `<div class="btnrow"><button class="btn primary" data-action="retry-pay" data-no="${esc(o.orderNo)}" data-key="${esc(key)}">Try paying again · ${lkr(o.total)}</button><a class="btn ghost" href="${waLink(`Hi Amethia! I need help paying for order ${o.orderNo}.`)}" target="_blank" rel="noopener">Get help on WhatsApp</a></div><p class="alert" id="retryerr" hidden></p>`;
  }
  const stages = ["new", "processing", "shipped", "delivered"];
  const reached = stages.indexOf(o.status);
  const paidOrCod = !isCard || st === "paid";
  app.innerHTML = `
  <div class="wrap orderbox">
    <div><p class="eyebrow">Order ${esc(o.orderNo)}</p><h1>${title}</h1></div>
    <p class="lead">${lead}</p>
    ${extra}
    ${paidOrCod && o.status !== "cancelled" ? `<ol class="steps">${["Order placed", "Being made", "On the way", "Delivered"].map((l, i) => `<li class="${i <= reached ? "done" : ""}">${l}</li>`).join("")}</ol>` : ""}
    <div class="summary">
      <h2>Your order</h2>
      ${o.items.map(i => `<div class="sumline"><span>${i.qty} × ${esc(i.name)}<br><span class="muted" style="font-size:13px">${esc(i.color)} · ${esc(i.size)}</span></span><span>${lkr(i.unit_price * i.qty)}</span></div>`).join("")}
      <div class="totals">
        <div><span>Subtotal</span><span>${lkr(o.subtotal)}</span></div>
        <div><span>Delivery</span><span>${o.delivery ? lkr(o.delivery) : "Free"}</span></div>
        <div class="grand"><span>Total</span><span>${lkr(o.total)}</span></div>
        <div><span class="muted">Payment</span><span class="muted">${isCard ? (st === "paid" ? "Paid by card" : "Card, not paid yet") : "Cash on delivery"}</span></div>
      </div>
    </div>
    <p class="muted" style="margin:0">Bookmark this page to check your order later.</p>
    <div><a class="btn ghost" href="/#shop">Continue shopping</a></div>
  </div>`;
  document.title = `Order ${o.orderNo} · Amethia`;

  clearTimeout(orderPoll);
  if (isCard && st === "pending" && !cancelled) {
    orderPage.tries = (orderPage.tries || 0) + 1;
    if (orderPage.tries < 40) orderPoll = setTimeout(() => orderPage(no, key, cancelled), 3000);
    else $(".lead").innerHTML = `We haven't heard back from PayHere yet. If money left your account, don't pay again. Message us on WhatsApp at ${prettyPhone()} with order number <b>${esc(o.orderNo)}</b> and we'll check it for you.`;
  }
}

/* ---------- bag drawer ---------- */
function renderBag() {
  const n = bag.reduce((a, l) => a + l.qty, 0);
  $("#drtitle").textContent = `Your bag (${n})`;
  if (!bag.length) {
    $("#drbody").innerHTML = `<div class="empty"><p>Your bag is empty.</p><a class="btn primary" href="/#shop" data-action="close-bag">Start shopping</a></div>`;
    $("#drfoot").innerHTML = ""; return;
  }
  $("#drbody").innerHTML = bag.map((l, i) => {
    const p = byId(l.id); const ci = Math.max(0, p.colors.findIndex(c => c[0] === l.color));
    return `<div class="line">
      <a class="pimg" href="/#p-${p.id}" data-action="close-bag">${pic(p, { color: ci })}</a>
      <div><h3>${esc(p.name)}</h3><div class="sub">${esc(l.color)} · Size ${esc(l.size)}</div>
        <div class="qty"><button data-action="lqty" data-i="${i}" data-d="-1" aria-label="Fewer">−</button><span>${l.qty}</span><button data-action="lqty" data-i="${i}" data-d="1" aria-label="More">+</button></div></div>
      <div class="right"><span>${lkr(p.price * l.qty)}</span><button class="rm" data-action="remove" data-i="${i}">Remove</button></div>
    </div>`;
  }).join("");
  const left = freeOver() - subtotal();
  $("#drfoot").innerHTML = `
    ${freeOver() ? `<p class="freebar">${left > 0 ? `Add ${lkr(left)} more for free delivery.` : "Your order qualifies for free delivery."}</p>` : ""}
    <div class="totals"><div><span>Subtotal</span><span>${lkr(subtotal())}</span></div><div><span>Delivery</span><span>${delivery() === 0 ? "Free" : lkr(delivery())}</span></div><div class="grand"><span>Total</span><span>${lkr(subtotal() + delivery())}</span></div></div>
    <a class="btn primary block" href="/#checkout" data-action="close-bag">Checkout</a>`;
}
let lastFocus = null;
function openBag() { lastFocus = document.activeElement; renderBag(); $("#drawer").hidden = false; $("#scrim").hidden = false; $("#drawer").querySelector("button").focus(); }
function closeBag() { $("#drawer").hidden = true; $("#scrim").hidden = true; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }

/* ---------- router ---------- */
let current = "";
function applyLinks() {
  document.querySelectorAll(".js-ig").forEach(a => { a.href = "https://instagram.com/" + STORE.instagram; a.target = "_blank"; a.rel = "noopener"; });
  document.querySelectorAll(".js-fb").forEach(a => { a.href = "https://facebook.com/" + STORE.facebook; a.target = "_blank"; a.rel = "noopener"; });
  document.querySelectorAll(".js-tt").forEach(a => { a.href = "https://www.tiktok.com/@" + STORE.tiktok; a.target = "_blank"; a.rel = "noopener"; });
}
function render(keepScroll) {
  const m = location.pathname.match(/^\/order\/([^/]+)\/([^/]+)(\/cancelled)?\/?$/);
  if (m && !location.hash) { orderPage(decodeURIComponent(m[1]), decodeURIComponent(m[2]), !!m[3]); applyLinks(); return; }
  if (location.pathname !== "/") { location.replace("/" + location.hash); return; }
  const h = location.hash.slice(1) || "home";
  const app = $("#app");
  if (h === "home") app.innerHTML = home();
  else if (h === "shop") app.innerHTML = shop("all");
  else if (h.startsWith("shop-")) app.innerHTML = shop(h.slice(5));
  else if (h.startsWith("p-")) app.innerHTML = product(h.slice(2));
  else if (h === "about") app.innerHTML = about();
  else if (h === "help") app.innerHTML = help();
  else if (h === "checkout") app.innerHTML = checkout();
  else app.innerHTML = home();
  const p = h.startsWith("p-") && byId(h.slice(2));
  document.title = p ? `${p.name} · Amethia` : h.startsWith("shop") ? `${(CATS[h.slice(5)] || CATS.all).name} · Amethia` : "Amethia";
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === h));
  applyLinks();
  if (!keepScroll && h !== current) window.scrollTo(0, 0);
  current = h;
  $("#mainnav").classList.remove("open"); $("#menubtn").setAttribute("aria-expanded", "false");
}
function rerenderKeepFocus() {
  const id = document.activeElement && document.activeElement.id;
  render(true);
  if (id && document.getElementById(id)) document.getElementById(id).focus();
}
window.addEventListener("hashchange", () => render());

/* ---------- events ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const a = t.dataset.action;
  if (a === "open-bag") openBag();
  if (a === "close-bag") closeBag();
  if (a === "view") { pdp.view = +t.dataset.v; rerenderKeepFocus(); }
  if (a === "color") { pdp.color = +t.dataset.i; rerenderKeepFocus(); }
  if (a === "size") { pdp.size = t.dataset.s; pdp.qty = Math.max(1, Math.min(pdp.qty, maxQty(byId(pdp.id), pdp.size))); pdp.err = ""; rerenderKeepFocus(); }
  if (a === "pqty") { pdp.qty = Math.max(1, Math.min(pdp.size ? maxQty(byId(pdp.id), pdp.size) : 10, pdp.qty + +t.dataset.d)); rerenderKeepFocus(); }
  if (a === "add") {
    if (!pdp.size) { pdp.err = "Please choose a size first."; rerenderKeepFocus(); return; }
    const p = byId(pdp.id), color = p.colors[pdp.color][0];
    // Stock is per size across all colours, so count what's already in the bag for this size.
    const inBag = bag.filter(l => l.id === p.id && l.size === pdp.size).reduce((n, l) => n + l.qty, 0);
    if (inBag + pdp.qty > sizeLeft(p, pdp.size)) { pdp.err = `Only ${sizeLeft(p, pdp.size)} left in this size, and ${inBag} ${inBag === 1 ? "is" : "are"} already in your bag.`; rerenderKeepFocus(); return; }
    const ex = bag.find(l => l.id === p.id && l.color === color && l.size === pdp.size);
    if (ex) ex.qty = Math.min(10, ex.qty + pdp.qty); else bag.push({ id: p.id, color, size: pdp.size, qty: pdp.qty });
    saveBag(); openBag();
  }
  if (a === "lqty") {
    const l = bag[+t.dataset.i], p = byId(l.id);
    const others = bag.filter(x => x !== l && x.id === l.id && x.size === l.size).reduce((n, x) => n + x.qty, 0);
    l.qty = Math.min(10, sizeLeft(p, l.size) - others, l.qty + +t.dataset.d);
    if (l.qty < 1) bag.splice(+t.dataset.i, 1); saveBag(); renderBag(); if (current === "checkout") render(true); }
  if (a === "remove") { bag.splice(+t.dataset.i, 1); saveBag(); renderBag(); if (current === "checkout") render(true); }
  if (a === "retry-pay") {
    t.disabled = true; t.textContent = "Opening PayHere…";
    try { const r = await api(`/api/orders/${encodeURIComponent(t.dataset.no)}/pay`, { method: "POST", body: { key: t.dataset.key } }); goToPayHere(r.payhere); }
    catch (err) { const el = $("#retryerr"); el.textContent = err.message; el.hidden = false; t.disabled = false; t.textContent = "Try paying again"; }
  }
});
document.addEventListener("change", e => {
  if (e.target.dataset.action === "sort") { sortBy = e.target.value; rerenderKeepFocus(); }
  if (e.target.name === "paymentMethod") { coDraft = Object.fromEntries(new FormData($("#coform"))); rerenderKeepFocus(); }
});
document.addEventListener("input", e => { if (e.target.form && e.target.form.id === "coform") coDraft[e.target.name] = e.target.value; });
document.addEventListener("submit", async e => {
  if (e.target.id !== "coform") return;
  e.preventDefault();
  if (coBusy) return;
  const form = e.target;
  coDraft = Object.fromEntries(new FormData(form));
  const missing = [...form.querySelectorAll("[required]")].find(i => !i.value.trim());
  if (missing) { coError = `Please fill in ${form.querySelector(`label[for="${missing.id}"]`).textContent.toLowerCase()}.`; render(true); document.getElementById(missing.id).focus(); return; }
  coError = ""; coBusy = true; render(true);
  try {
    const r = await api("/api/orders", { method: "POST", body: { customer: coDraft, paymentMethod: coDraft.paymentMethod, items: bag } });
    bag = []; saveBag(); coBusy = false;
    if (r.payhere) goToPayHere(r.payhere);
    else location.href = `/order/${r.orderNo}/${r.key}`;
  } catch (err) {
    coBusy = false; coError = err.message; render(true);
    const al = document.querySelector("#coform .alert"); if (al) al.scrollIntoView({ block: "center" });
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#drawer").hidden) closeBag(); });
$("#menubtn").addEventListener("click", () => {
  const open = $("#mainnav").classList.toggle("open");
  $("#menubtn").setAttribute("aria-expanded", String(open));
});
// If the customer comes back with the browser's Back button from PayHere, refresh the page state.
window.addEventListener("pageshow", ev => { if (ev.persisted) { coBusy = false; render(true); } });

/* ---------- start ---------- */
(async function start() {
  $("#year").textContent = new Date().getFullYear();
  try {
    const data = await api("/api/store");
    STORE = data.settings; PRODUCTS = data.products; CARD_PAYMENTS = data.cardPayments;
  } catch (e) {
    $("#app").innerHTML = `<div class="loading">The shop couldn't load. Please refresh the page.</div>`; return;
  }
  if (STORE.announcement) $("#announce").textContent = STORE.announcement; else $("#announce").hidden = true;
  loadBag(); updateCount(); render();
})();
