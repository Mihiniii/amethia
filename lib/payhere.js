// PayHere checkout helpers.
// Docs: https://support.payhere.lk/api-&-mobile-sdk/checkout-api
const crypto = require("node:crypto");
const config = require("./config");

const md5 = s => crypto.createHash("md5").update(s).digest("hex").toUpperCase();
const money = n => Number(n).toFixed(2);

// hash = UPPER(MD5(merchant_id + order_id + amount + currency + UPPER(MD5(merchant_secret))))
function checkoutHash(orderId, amount, currency = "LKR") {
  const { merchantId, merchantSecret } = config.payhere;
  return md5(merchantId + orderId + money(amount) + currency + md5(merchantSecret));
}

// md5sig = UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(MD5(merchant_secret))))
function verifyNotification(p) {
  const { merchantId, merchantSecret } = config.payhere;
  if (!p || p.merchant_id !== merchantId) return false;
  const expected = md5(p.merchant_id + p.order_id + p.payhere_amount + p.payhere_currency + p.status_code + md5(merchantSecret));
  const got = String(p.md5sig || "").toUpperCase();
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

const STATUS = { "2": "paid", "0": "pending", "-1": "cancelled", "-2": "failed", "-3": "chargeback" };

// Builds the fields for the form that sends the customer to PayHere.
function checkoutFields(order, items, attempt) {
  const payhereOrderId = `${order.order_no}-${attempt}`;
  const base = `${config.siteUrl}/order/${order.order_no}/${order.access_key}`;
  const fields = {
    merchant_id: config.payhere.merchantId,
    return_url: base,
    cancel_url: `${base}/cancelled`,
    notify_url: `${config.siteUrl}/api/payhere/notify`,
    order_id: payhereOrderId,
    items: `Amethia order ${order.order_no}`,
    currency: "LKR",
    amount: money(order.total),
    first_name: order.first_name,
    last_name: order.last_name,
    email: order.email,
    phone: order.phone,
    address: order.address,
    city: order.city,
    country: "Sri Lanka",
    delivery_address: order.address,
    delivery_city: order.city,
    delivery_country: "Sri Lanka",
    custom_1: order.order_no,
  };
  items.forEach((it, i) => {
    const n = i + 1;
    fields[`item_name_${n}`] = `${it.name} (${it.color}, ${it.size})`;
    fields[`item_number_${n}`] = it.product_id;
    fields[`amount_${n}`] = money(it.unit_price);
    fields[`quantity_${n}`] = String(it.qty);
  });
  fields.hash = checkoutHash(payhereOrderId, order.total, "LKR");
  return { action: config.payhere.checkoutUrl, fields };
}

module.exports = { checkoutHash, verifyNotification, checkoutFields, STATUS, money, md5 };
