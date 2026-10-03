/* Amethia admin panel: orders, products and store settings. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const lkr = n => "LKR " + Number(n).toLocaleString("en-US");
const when = s => new Date(s.replace(" ", "T") + "Z").toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const CAT_NAMES = { dresses: "Dresses", tops: "Tops", bottoms: "Skirts & pants", coords: "Co-ord sets" };
const TYPE_NAMES = { dress: "A-line dress", maxi: "Maxi dress", slip: "Slip dress", top: "Top", blouse: "Blouse", skirt: "Skirt", pants: "Pants", coord: "Co-ord set" };
const ORDER_ST = { new: "New", processing: "Being made", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
const PAY_ST = { unpaid: "Unpaid (COD)", pending: "Awaiting payment", paid: "Paid", failed: "Failed", cancelled: "Cancelled", chargeback: "Chargeback", refunded: "Refunded" };

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "same-origin", headers: opts.body ? { "Content-Type": "application/json" } : {}, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.endsWith("/login") && !path.endsWith("/me")) { showLogin("You've been logged out. Please log in again."); throw new Error("Logged out"); }
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600); }

function payPill(o) {
  if (o.payment_method === "cod") return o.payment_status === "paid" ? `<span class="pill good">COD · paid</span>` : `<span class="pill info">Cash on delivery</span>`;
  const cls = { paid: "good", pending: "warn", failed: "bad", cancelled: "bad", chargeback: "bad", refunded: "mute" }[o.payment_status] || "mute";
  return `<span class="pill ${cls}">${PAY_ST[o.payment_status] || o.payment_status}</span>`;
}
function statusPill(s) {
  const cls = { new: "warn", processing: "info", shipped: "info", delivered: "good", cancelled: "mute" }[s] || "mute";
  return `<span class="pill ${cls}">${ORDER_ST[s] || s}</span>`;
}
function pic(p, i = 0) {
  return p.images && p.images.length ? `<img src="/api/images/${p.images[Math.min(i, p.images.length - 1)]}" alt="">` : garment(p.type, (p.colors[0] || [])[1]);
}

/* ---------------- login ---------------- */
function showLogin(msg = "") {
  $("#root").innerHTML = `
  <form class="login" id="loginform">
    <h1>Amethia admin</h1>
    <p class="muted" style="margin:0">Log in to manage orders and products.</p>
    <div class="field"><label for="pw">Password</label><input type="password" id="pw" autocomplete="current-password" required></div>
    ${msg ? `<p class="alert" role="alert">${esc(msg)}</p>` : ""}
    <button class="btn primary block" type="submit">Log in</button>
    <a class="link" href="/" style="justify-self:start">Back to the shop</a>
  </form>`;
  $("#pw").focus();
}
document.addEventListener("submit", async e => {
  if (e.target.id === "loginform") {
    e.preventDefault();
    try { await api("/api/admin/login", { method: "POST", body: { password: $("#pw").value } }); boot(); }
    catch (err) { showLogin(err.message); }
  }
  if (e.target.id === "pform") { e.preventDefault(); saveProduct(); }
  if (e.target.id === "sform") { e.preventDefault(); saveSettings(); }
  if (e.target.id === "ofilter") { e.preventDefault(); loadOrders(); }
});

/* ---------------- shell ---------------- */
let ME = null, tab = "orders";
function shell() {
  const ph = ME.payhere;
  $("#root").innerHTML = `
  <div class="abar"><div class="wrap">
    <span class="logo">Amethia<small>Admin</small></span>
    <nav>
      <span class="pill ${ph.enabled ? (ph.sandbox ? "warn" : "good") : "bad"}">PayHere: ${ph.enabled ? (ph.sandbox ? "test mode" : "live") : "off"}</span>
      <a href="/" target="_blank" rel="noopener">View shop</a>
      <button data-action="logout">Log out</button>
    </nav>
  </div></div>
  <div class="wrap">
    <div class="tabs" role="tablist">
      ${[["orders", "Orders"], ["products", "Products"], ["settings", "Settings"]].map(([k, l]) => `<button class="tab" role="tab" data-action="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}
    </div>
    <div class="panel" id="view"></div>
  </div>`;
  if (tab === "orders") ordersView();
  if (tab === "products") productsView();
  if (tab === "settings") settingsView();
}

/* ---------------- orders ---------------- */
let ofilter = { q: "", status: "", payment: "" };
function ordersView() {
  $("#view").innerHTML = `
  <div class="tiles" id="tiles"></div>
  <form class="filters" id="ofilter">
    <input type="text" id="oq" placeholder="Search order no, name, phone" value="${esc(ofilter.q)}" aria-label="Search orders">
    <select id="ost" class="full" style="width:auto" aria-label="Order status"><option value="">All statuses</option>${Object.entries(ORDER_ST).map(([k, v]) => `<option value="${k}" ${ofilter.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
    <select id="opay" class="full" style="width:auto" aria-label="Payment status"><option value="">All payments</option>${Object.entries(PAY_ST).map(([k, v]) => `<option value="${k}" ${ofilter.payment === k ? "selected" : ""}>${v}</option>`).join("")}</select>
    <button class="btn ghost" type="submit">Search</button>
  </form>
  <div id="olist"><div class="loading" style="padding-block:40px">Loading orders…</div></div>`;
  loadOrders();
}
async function loadOrders() {
  ofilter = { q: $("#oq").value.trim(), status: $("#ost").value, payment: $("#opay").value };
  const qs = new URLSearchParams(Object.entries(ofilter).filter(([, v]) => v));
  const { orders, summary } = await api("/api/admin/orders?" + qs);
  $("#tiles").innerHTML = `
    <div class="tile"><div class="n">${summary.toProcess}</div><div class="l">To make &amp; ship</div></div>
    <div class="tile"><div class="n">${summary.awaitingPayment}</div><div class="l">Card not paid yet</div></div>
    <div class="tile"><div class="n">${summary.ordersThisMonth}</div><div class="l">Orders this month</div></div>
    <div class="tile"><div class="n">${lkr(summary.paidThisMonth)}</div><div class="l">Paid this month</div></div>`;
  $("#olist").innerHTML = orders.length ? `
  <div class="tbl-wrap"><table class="otable">
    <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
    <tbody>${orders.map(o => `<tr data-action="open-order" data-id="${o.id}" tabindex="0">
      <td><b style="font-weight:500">${esc(o.order_no)}</b></td><td>${when(o.created_at)}</td>
      <td>${esc(o.first_name)} ${esc(o.last_name)}<br><span class="muted" style="font-size:13px">${esc(o.city)}</span></td>
      <td>${o.item_count}</td><td>${lkr(o.total)}</td><td>${payPill(o)}</td><td>${statusPill(o.status)}</td></tr>`).join("")}</tbody>
  </table></div>` : `<div class="empty"><p>No orders ${ofilter.q || ofilter.status || ofilter.payment ? "match these filters" : "yet. They'll appear here as soon as customers check out"}.</p></div>`;
}
async function openOrder(id) {
  const o = await api("/api/admin/orders/" + id);
  const wa = "https://wa.me/" + o.phone.replace(/\D/g, "").replace(/^0/, "94");
  $("#ptitle").textContent = `Order ${o.order_no}`;
  $("#pbody").innerHTML = `
  <div style="display:grid;gap:22px;padding-block:16px">
    <div style="display:flex;gap:8px;flex-wrap:wrap">${payPill(o)} ${statusPill(o.status)}</div>
    <dl class="kv">
      <dt>Placed</dt><dd>${when(o.created_at)}</dd>
      <dt>Customer</dt><dd>${esc(o.first_name)} ${esc(o.last_name)}</dd>
      <dt>Phone</dt><dd>${esc(o.phone)} · <a href="${wa}" target="_blank" rel="noopener">WhatsApp</a></dd>
      <dt>Email</dt><dd><a href="mailto:${esc(o.email)}">${esc(o.email)}</a></dd>
      <dt>Address</dt><dd>${esc(o.address)}, ${esc(o.city)}${o.district ? ", " + esc(o.district) : ""}</dd>
      ${o.notes ? `<dt>Notes</dt><dd>${esc(o.notes)}</dd>` : ""}
      <dt>Payment</dt><dd>${o.payment_method === "card" ? "Card (PayHere)" : "Cash on delivery"}${o.payment_ref ? ` · PayHere ID ${esc(o.payment_ref)}` : ""}${o.payment_info ? ` · ${esc(o.payment_info)}` : ""}</dd>
    </dl>
    <div class="summary" style="padding:18px">
      ${o.items.map(i => `<div class="sumline"><span>${i.qty} × ${esc(i.name)}<br><span class="muted" style="font-size:13px">${esc(i.color)} · ${esc(i.size)}</span></span><span>${lkr(i.unit_price * i.qty)}</span></div>`).join("")}
      <div class="totals"><div><span>Subtotal</span><span>${lkr(o.subtotal)}</span></div><div><span>Delivery</span><span>${o.delivery ? lkr(o.delivery) : "Free"}</span></div><div class="grand"><span>Total</span><span>${lkr(o.total)}</span></div></div>
    </div>
    ${o.payment_method === "card" && o.payment_status !== "paid" && o.status !== "cancelled" ? `<p class="notice" style="margin:0">This card order hasn't been paid. Don't make or ship it until the payment shows as Paid.</p>` : ""}
    <div class="form">
      <div class="field"><label for="o-status">Order status</label><select id="o-status" class="full">${Object.entries(ORDER_ST).map(([k, v]) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="field"><label for="o-pay">Payment status</label><select id="o-pay" class="full">${Object.entries(PAY_ST).map(([k, v]) => `<option value="${k}" ${o.payment_status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <span class="muted" style="font-size:13px">PayHere updates card payments automatically. Change this by hand only for cash on delivery or refunds.</span></div>
      <button class="btn primary" data-action="save-order" data-id="${o.id}">Save changes</button>
    </div>
    ${o.payments.length ? `<div><p class="eyebrow">PayHere messages</p><div class="tbl-wrap"><table><thead><tr><th>Time</th><th>Result</th><th>Method</th><th>Check</th></tr></thead><tbody>
      ${o.payments.map(p => `<tr><td>${when(p.at)}</td><td>${esc(p.status)}</td><td>${esc(p.method)}</td><td>${p.valid ? "Verified" : "Rejected"}</td></tr>`).join("")}</tbody></table></div></div>` : ""}
  </div>`;
  openPanel();
}
async function saveOrder(id) {
  await api("/api/admin/orders/" + id, { method: "PATCH", body: { status: $("#o-status").value, paymentStatus: $("#o-pay").value } });
  toast("Order updated"); closePanel(); loadOrders();
}

/* ---------------- products ---------------- */
let PDATA = null;
async function productsView() {
  $("#view").innerHTML = `<div class="loading" style="padding-block:40px">Loading products…</div>`;
  PDATA = await api("/api/admin/products");
  $("#view").innerHTML = `
  <div class="sec-head" style="margin-bottom:20px"><h2 style="font-size:32px">Products</h2><button class="btn primary" data-action="new-product">Add product</button></div>
  ${PDATA.products.some(p => p.badge === "Sample") ? `<p class="notice">Products marked <b>Sample</b> are examples. Edit them into real designs, or delete them before you launch.</p>` : ""}
  <div class="plist">${PDATA.products.map(p => `
    <button class="pitem" data-action="edit-product" data-id="${esc(p.id)}">
      <div class="pimg">${pic(p)}</div>
      <div class="pi"><h3>${esc(p.name)}</h3><span class="muted">${lkr(p.price)} · ${CAT_NAMES[p.category]}</span>
        <span style="display:flex;gap:6px;flex-wrap:wrap">${p.active ? `<span class="pill good">On sale</span>` : `<span class="pill mute">Hidden</span>`}${p.soldOut ? `<span class="pill bad">Sold out</span>` : Object.values(p.stock).some(n => n === 0) ? `<span class="pill warn">Some sizes sold out</span>` : ""}${p.badge === "Sample" ? `<span class="pill warn">Sample</span>` : ""}</span></div>
    </button>`).join("")}</div>`;
}
let editing = null, delArmed = false;
function editProduct(id) {
  const p = id ? PDATA.products.find(x => x.id === id) : { id: "", name: "", category: "dresses", type: "dress", price: "", badge: "", intro: "", description: "", fabric: "", colors: [["", "#6A2C91"]], sizes: ["XS", "S", "M", "L", "XL"], stock: {}, active: true, markedSoldOut: false, sort: PDATA.products.length, images: [] };
  editing = JSON.parse(JSON.stringify(p)); editing.isNew = !id; delArmed = false;
  renderProductForm();
}
function renderProductForm(err = "") {
  const p = editing;
  $("#view").innerHTML = `
  <p><button class="small" data-action="back-products">← All products</button></p>
  <h2 style="font-size:32px;margin-bottom:20px">${p.isNew ? "Add product" : esc(p.name)}</h2>
  <div class="pform">
    <form class="form" id="pform" novalidate>
      <div class="field"><label for="p-name">Name</label><input type="text" id="p-name" value="${esc(p.name)}" required></div>
      <div class="row2">
        <div class="field"><label for="p-price">Price (LKR)</label><input type="number" id="p-price" min="0" step="1" value="${esc(p.price)}" required></div>
        <div class="field"><label for="p-badge">Badge (optional)</label><input type="text" id="p-badge" value="${esc(p.badge)}" placeholder="New, Bestseller…"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="p-cat">Category</label><select id="p-cat" class="full">${PDATA.categories.map(c => `<option value="${c}" ${p.category === c ? "selected" : ""}>${CAT_NAMES[c]}</option>`).join("")}</select></div>
        <div class="field"><label for="p-type">Drawing shown until photos are added</label><select id="p-type" class="full">${PDATA.types.map(t => `<option value="${t}" ${p.type === t ? "selected" : ""}>${TYPE_NAMES[t]}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="p-intro">Short intro</label><textarea id="p-intro" rows="2">${esc(p.intro)}</textarea></div>
      <div class="field"><label for="p-desc">Description</label><textarea id="p-desc" rows="4">${esc(p.description)}</textarea></div>
      <div class="field"><label for="p-fabric">Fabric &amp; care</label><textarea id="p-fabric" rows="2">${esc(p.fabric)}</textarea></div>
      <div class="field"><span class="optlabel">Colours</span>
        <div style="display:grid;gap:8px" id="colors">${p.colors.map((c, i) => `
          <div class="colorrow"><input type="text" id="c-name-${i}" value="${esc(c[0])}" placeholder="Colour name" aria-label="Colour name"><input type="color" id="c-hex-${i}" value="${esc(c[1])}" aria-label="Colour"><button type="button" class="small danger" data-action="rm-color" data-i="${i}" ${p.colors.length === 1 ? "disabled" : ""}>Remove</button></div>`).join("")}</div>
        <button type="button" class="small" style="justify-self:start" data-action="add-color" ${p.colors.length >= 8 ? "disabled" : ""}>+ Add colour</button>
      </div>
      <div class="field"><span class="optlabel">Sizes available and stock</span>
        <div class="checks">${PDATA.sizes.map(s => `<label class="stockrow"><input type="checkbox" name="size" value="${s}" ${p.sizes.includes(s) ? "checked" : ""}> ${s}
          <input type="number" class="stockin" id="${stockId(s)}" min="0" step="1" value="${esc(p.stock[s] ?? "")}" placeholder="No limit" aria-label="Pieces in stock, size ${s}"></label>`).join("")}</div>
        <span class="muted" style="font-size:13px">Pieces in stock for each size, counted across all colours. Leave blank for made-to-order sizes with no limit. Orders take pieces out automatically; cancelling an order puts them back.</span></div>
      <div class="checks">
        <label><input type="checkbox" id="p-active" ${p.active ? "checked" : ""}> Show in shop</label>
        <label><input type="checkbox" id="p-sold" ${p.markedSoldOut ? "checked" : ""}> Sold out (all sizes)</label>
      </div>
      <div class="field" style="max-width:200px"><label for="p-sort">Position in shop</label><input type="number" id="p-sort" step="1" value="${esc(p.sort)}"><span class="muted" style="font-size:13px">Lower numbers show first.</span></div>
      ${err ? `<p class="alert" role="alert">${esc(err)}</p>` : ""}
      <div class="btnrow">
        <button class="btn primary" type="submit">${p.isNew ? "Add product" : "Save changes"}</button>
        ${p.isNew ? "" : delArmed ? `<button type="button" class="btn ghost" style="border-color:var(--danger);color:var(--danger)" data-action="delete-product">Yes, delete for good</button><button type="button" class="btn ghost" data-action="cancel-delete">Keep it</button>` : `<button type="button" class="btn ghost" data-action="arm-delete">Delete</button>`}
      </div>
      ${delArmed ? `<p class="muted" style="margin:0">Past orders keep their details. You can also untick "Show in shop" to hide it instead.</p>` : ""}
    </form>
    <div class="form">
      <span class="optlabel">Photos</span>
      ${p.isNew ? `<p class="notice">Save the product first, then add photos.</p>` : `
        <div class="photos">${p.images.map((id, i) => `<div class="photo"><div class="pimg"><img src="/api/images/${id}" alt=""></div><div class="row">${i === 0 ? `<span class="muted" style="font-size:12.5px">Main photo</span>` : `<button class="small" data-action="img-first" data-id="${id}">Make main</button>`}<button class="small danger" data-action="img-del" data-id="${id}">Remove</button></div></div>`).join("")}
          ${p.images.length ? "" : `<div class="photo"><div class="pimg">${garment(p.type, (p.colors[0] || [])[1])}</div><span class="muted" style="font-size:12.5px">Drawing shown until you add a photo</span></div>`}
        </div>
        <label class="btn ghost" for="p-files" style="justify-self:start">Upload photos</label>
        <input type="file" id="p-files" accept="image/jpeg,image/png,image/webp" multiple hidden>
        <span class="muted" style="font-size:13px" id="upmsg">JPG, PNG or WebP. Photos are resized automatically. Portrait (3:4) photos look best.</span>`}
    </div>
  </div>`;
}
function readForm() {
  const n = editing.colors.length;
  editing.name = $("#p-name").value; editing.price = $("#p-price").value; editing.badge = $("#p-badge").value;
  editing.category = $("#p-cat").value; editing.type = $("#p-type").value;
  editing.intro = $("#p-intro").value; editing.description = $("#p-desc").value; editing.fabric = $("#p-fabric").value;
  editing.colors = Array.from({ length: n }, (_, i) => [$("#c-name-" + i).value.trim(), $("#c-hex-" + i).value]);
  editing.sizes = [...document.querySelectorAll('input[name="size"]:checked')].map(i => i.value);
  editing.stock = Object.fromEntries(PDATA.sizes.map(s => [s, $("#" + stockId(s)).value.trim()]).filter(([, v]) => v !== ""));
  editing.active = $("#p-active").checked; editing.markedSoldOut = $("#p-sold").checked; editing.sort = $("#p-sort").value;
}
const stockId = s => "st-" + s.replace(/\W/g, "");
async function saveProduct() {
  readForm();
  const body = { ...editing, price: Number(editing.price), sort: Number(editing.sort) || 0 };
  try {
    const saved = editing.isNew ? await api("/api/admin/products", { method: "POST", body }) : await api("/api/admin/products/" + encodeURIComponent(editing.id), { method: "PUT", body });
    PDATA = await api("/api/admin/products");
    toast(editing.isNew ? "Product added" : "Changes saved");
    editProduct(saved.id);
  } catch (e) { renderProductForm(e.message); }
}
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name} isn't an image we can read.`)); };
    img.src = url;
  });
}
async function uploadPhotos(files) {
  const msg = $("#upmsg");
  try {
    for (let i = 0; i < files.length; i++) {
      msg.textContent = `Uploading photo ${i + 1} of ${files.length}…`;
      const data = await resizeImage(files[i]);
      await api(`/api/admin/products/${encodeURIComponent(editing.id)}/images`, { method: "POST", body: { data } });
    }
    await refreshEditing(); toast(files.length === 1 ? "Photo added" : `${files.length} photos added`);
  } catch (e) { msg.textContent = e.message; }
}
async function refreshEditing() {
  readForm();
  const draft = { ...editing };
  PDATA = await api("/api/admin/products");
  const fresh = PDATA.products.find(x => x.id === draft.id);
  editing = { ...draft, images: fresh ? fresh.images : [] };
  renderProductForm();
}

/* ---------------- settings ---------------- */
async function settingsView() {
  const s = await api("/api/admin/settings");
  const f = (id, label, val, extra = "") => `<div class="field"><label for="s-${id}">${label}</label><input type="text" id="s-${id}" value="${esc(val)}" ${extra}></div>`;
  $("#view").innerHTML = `
  <form class="form" id="sform" style="max-width:640px" novalidate>
    <h2 style="font-size:32px">Store settings</h2>
    ${f("store_name", "Store name", s.store_name)}
    ${f("announcement", "Announcement bar (top of every page)", s.announcement)}
    <div class="row2">${f("whatsapp", "WhatsApp number with country code", s.whatsapp, 'inputmode="numeric" placeholder="94771234567"')}${f("email", "Email", s.email)}</div>
    <div class="row2">${f("instagram", "Instagram username", s.instagram)}${f("tiktok", "TikTok username", s.tiktok)}</div>
    ${f("facebook", "Facebook page name", s.facebook)}
    <div class="row2">
      <div class="field"><label for="s-delivery_fee">Delivery fee (LKR)</label><input type="number" id="s-delivery_fee" min="0" step="1" value="${esc(s.delivery_fee)}"></div>
      <div class="field"><label for="s-free_delivery_over">Free delivery over (LKR, 0 = never)</label><input type="number" id="s-free_delivery_over" min="0" step="1" value="${esc(s.free_delivery_over)}"></div>
    </div>
    <div class="checks"><label><input type="checkbox" id="s-cod_enabled" ${s.cod_enabled === "1" ? "checked" : ""}> Offer cash on delivery</label></div>
    <p class="alert" id="serr" hidden role="alert"></p>
    <button class="btn primary" type="submit" style="justify-self:start">Save settings</button>
    <p class="notice" style="margin-top:12px">PayHere keys and the admin password are kept in the server's <b>.env</b> file, not here, so they can't leak from the website.</p>
  </form>`;
}
async function saveSettings() {
  const keys = ["store_name", "announcement", "whatsapp", "email", "instagram", "tiktok", "facebook", "delivery_fee", "free_delivery_over"];
  const body = Object.fromEntries(keys.map(k => [k, $("#s-" + k).value]));
  body.cod_enabled = $("#s-cod_enabled").checked;
  try { await api("/api/admin/settings", { method: "PUT", body }); $("#serr").hidden = true; toast("Settings saved"); }
  catch (e) { $("#serr").textContent = e.message; $("#serr").hidden = false; }
}

/* ---------------- side panel ---------------- */
let lastFocus = null;
function openPanel() { lastFocus = document.activeElement; $("#panel").hidden = false; $("#scrim").hidden = false; $("#panel").querySelector("button").focus(); }
function closePanel() { $("#panel").hidden = true; $("#scrim").hidden = true; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }

/* ---------------- events ---------------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const a = t.dataset.action;
  try {
    if (a === "tab") { tab = t.dataset.tab; shell(); }
    if (a === "logout") { await api("/api/admin/logout", { method: "POST" }); showLogin(); }
    if (a === "open-order") await openOrder(t.dataset.id);
    if (a === "save-order") await saveOrder(t.dataset.id);
    if (a === "close-panel") closePanel();
    if (a === "new-product") editProduct(null);
    if (a === "edit-product") editProduct(t.dataset.id);
    if (a === "back-products") productsView();
    if (a === "add-color") { readForm(); editing.colors.push(["", "#9E6FA8"]); renderProductForm(); }
    if (a === "rm-color") { readForm(); editing.colors.splice(+t.dataset.i, 1); renderProductForm(); }
    if (a === "arm-delete") { readForm(); delArmed = true; renderProductForm(); }
    if (a === "cancel-delete") { readForm(); delArmed = false; renderProductForm(); }
    if (a === "delete-product") { await api("/api/admin/products/" + encodeURIComponent(editing.id), { method: "DELETE" }); toast("Product deleted"); productsView(); }
    if (a === "img-first") { await api(`/api/admin/images/${t.dataset.id}/first`, { method: "POST" }); await refreshEditing(); }
    if (a === "img-del") { await api(`/api/admin/images/${t.dataset.id}`, { method: "DELETE" }); await refreshEditing(); toast("Photo removed"); }
  } catch (err) { if (err.message !== "Logged out") toast(err.message); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("#panel").hidden) closePanel();
  if (e.key === "Enter" && e.target.matches("tr[data-action='open-order']")) openOrder(e.target.dataset.id);
});
document.addEventListener("change", e => {
  if (e.target.id === "p-files" && e.target.files.length) uploadPhotos([...e.target.files]);
  if (e.target.id === "ost" || e.target.id === "opay") loadOrders();
});

async function boot() {
  try { ME = await api("/api/admin/me"); shell(); }
  catch (e) { if (e.message !== "Logged out") showLogin(); }
}
boot();
