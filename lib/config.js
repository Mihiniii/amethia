// Loads settings from the .env file (no extra packages needed).
const fs = require("node:fs");
const path = require("node:path");

const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

const env = process.env;
const config = {
  port: Number(env.PORT) || 3000,
  siteUrl: (env.SITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  adminPassword: env.ADMIN_PASSWORD || "",
  sessionSecret: env.SESSION_SECRET || "",
  dbPath: path.resolve(__dirname, "..", env.DB_PATH || "./data/shop.db"),
  payhere: {
    merchantId: env.PAYHERE_MERCHANT_ID || "",
    merchantSecret: env.PAYHERE_MERCHANT_SECRET || "",
    sandbox: (env.PAYHERE_SANDBOX || "true").toLowerCase() !== "false",
  },
};
config.payhere.enabled = Boolean(config.payhere.merchantId && config.payhere.merchantSecret);
config.payhere.checkoutUrl = config.payhere.sandbox
  ? "https://sandbox.payhere.lk/pay/checkout"
  : "https://www.payhere.lk/pay/checkout";
config.secureCookies = config.siteUrl.startsWith("https://");

if (!config.adminPassword || config.adminPassword === "change-this-password") {
  console.warn("⚠  Set ADMIN_PASSWORD in .env before going live. The admin panel is locked until you do.");
}
if (!config.sessionSecret || config.sessionSecret.length < 16) {
  console.warn("⚠  SESSION_SECRET is missing or short. Using a temporary one; admins will be logged out on restart.");
  config.sessionSecret = require("node:crypto").randomBytes(32).toString("hex");
}
if (!config.payhere.enabled) {
  console.warn("⚠  PayHere is not configured. Card payments are switched off until PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET are set.");
}

module.exports = config;
