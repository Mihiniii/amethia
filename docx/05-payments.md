# Payments

The shop offers two ways to pay:

- **Card**, through PayHere's hosted checkout page. PayHere handles Visa, Mastercard, Amex and mobile wallets. Card details never touch this website.
- **Cash on delivery**, which can be switched on or off in the admin settings.

Card payments are available only when `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` are set in `.env`. Without them the checkout offers cash on delivery only.

## Set up the PayHere sandbox

1. Create a sandbox account at https://sandbox.payhere.lk.
2. Go to **Settings → Domains & Credentials** and add the domain you will test on. PayHere then shows a Merchant ID and a Merchant Secret for that domain.
3. Put them in `.env`:

```
PAYHERE_MERCHANT_ID=121XXXX
PAYHERE_MERCHANT_SECRET=xxxxxxxx
PAYHERE_SANDBOX=true
```

4. Restart the server. The startup output ends with `PayHere: sandbox (test payments)`.

Pay with the test card numbers listed in PayHere's sandbox documentation. No real money moves.

## How a card payment works

1. The customer submits the checkout. The server saves the order with payment status `pending` and returns the PayHere form fields.
2. The browser posts those fields to PayHere and the customer pays on PayHere's page.
3. PayHere's server sends a notification to `SITE_URL/api/payhere/notify`. The shop verifies it and sets the payment status.
4. PayHere sends the customer back to `SITE_URL/order/<order number>/<key>`. That page checks the order every 3 seconds until it is no longer `pending`.

If the customer cancels on PayHere's page, they return to `.../cancelled`, where a "Try paying again" button starts a new attempt.

Step 3 is the only thing that marks an order paid. The customer returning to the site does not.

## Testing on your own computer

PayHere can reach `/api/payhere/notify` only when the site is on the public internet. On `localhost` the payment page opens and the payment can be completed, but the order stays "Awaiting payment".

To test the whole flow locally, use a tunnel:

1. Run `ngrok http 3000`.
2. Set `SITE_URL` in `.env` to the `https://` address ngrok shows.
3. Add that domain under Domains & Credentials in the PayHere sandbox and use the Merchant Secret shown for it.
4. Restart the server and open the shop through the ngrok address.

## The checkout form

`lib/payhere.js` builds the fields in `checkoutFields`.

| Field | Value |
|---|---|
| `merchant_id` | From `.env` |
| `order_id` | Order number plus the attempt number, for example `AM1001-1` |
| `amount` | Order total with two decimals, for example `6900.00` |
| `currency` | `LKR` |
| `return_url` | `SITE_URL/order/<order number>/<key>` |
| `cancel_url` | The return address followed by `/cancelled` |
| `notify_url` | `SITE_URL/api/payhere/notify` |
| `items` | `Amethia order <order number>` |
| customer fields | Name, email, phone, address and city from the order. Country is always Sri Lanka. |
| `item_name_N`, `item_number_N`, `amount_N`, `quantity_N` | One set per order line |
| `custom_1` | The order number |
| `hash` | The signature described below |

Each retry uses a new `order_id` ending, such as `AM1001-2`, because PayHere does not accept the same order ID twice. The shop removes the ending to find the order again.

The form is posted to `https://sandbox.payhere.lk/pay/checkout` in sandbox mode and to `https://www.payhere.lk/pay/checkout` in live mode.

## Signatures

Both signatures use MD5 written in capital letters, as PayHere specifies.

The checkout hash sent to PayHere:

```
hash = UPPER(MD5(merchant_id + order_id + amount + currency + UPPER(MD5(merchant_secret))))
```

The signature PayHere sends with each notification:

```
md5sig = UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(MD5(merchant_secret))))
```

The Merchant Secret is never sent to the browser. Only the finished hash is.

## How a notification is checked

For each notification the server does the following, in this order:

1. Computes the expected `md5sig` and compares it with the one received. The merchant ID must also match.
2. Writes the notification to the `payment_log` table, whether it was valid or not.
3. Rejects it with 400 if the signature was wrong.
4. Finds the order. Answers 404 if there is none.
5. Rejects it with 400 if the currency is not LKR or the amount differs from the order total.
6. Leaves the order unchanged if it is already `paid`, unless the new status is a chargeback. This stops a late "cancelled" or "pending" message from undoing a confirmed payment.
7. Otherwise saves the new payment status, the PayHere payment ID and the payment method.

PayHere status codes are mapped as follows:

| Code | Payment status |
|---|---|
| 2 | `paid` |
| 0 | `pending` |
| -1 | `cancelled` |
| -2 | `failed` |
| -3 | `chargeback` |

## Cash on delivery

A cash on delivery order is saved with payment status `unpaid` and is ready to be made straight away. When the courier has handed over the money, set the payment to **Paid** in the admin panel.

## Going live

1. Apply for a live merchant account at https://www.payhere.lk. PayHere asks for business documents before approving it.
2. Add your real domain under Domains & Credentials in the live account.
3. In `.env`, set the live Merchant ID and Secret, `PAYHERE_SANDBOX=false` and `SITE_URL=https://yourdomain.lk`.
4. Restart. The startup output ends with `PayHere: LIVE`.
5. Place one real low-value order yourself and check that it shows as **Paid** in the admin panel.

PayHere live mode requires the site to use HTTPS.

## Troubleshooting

| Problem | Likely cause | What to check |
|---|---|---|
| Checkout offers only cash on delivery | PayHere keys are missing | Both keys are in `.env` and the server was restarted |
| Order stays "Awaiting payment" after paying | PayHere cannot reach the notify address | `SITE_URL` is a public `https://` address, not `localhost` |
| Server log shows "notification rejected ... bad signature" | The Merchant Secret does not belong to the domain in use, or sandbox and live keys are mixed | The secret for that exact domain, and the `PAYHERE_SANDBOX` value |
| Server log shows "amount mismatch" | The amount PayHere reports differs from the order total | The payment history in the admin order view |
| PayHere shows "Unauthorized payment request" | The domain is not approved in PayHere, or the hash is wrong | The domain under Domains & Credentials and the Merchant Secret |

The admin order view lists every notification received for an order, including rejected ones.
