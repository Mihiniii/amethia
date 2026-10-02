# API reference

All endpoints live under `/api/` on the same address as the shop, for example `http://localhost:3000/api/store`.

## Conventions

- Request bodies are JSON and must be sent with `Content-Type: application/json`. A different content type gets status 415. The one exception is the PayHere notification, which is form-encoded.
- JSON bodies are limited to 100 KB. Photo uploads are limited to 8 MB.
- Successful replies are JSON with status 200.
- Errors are JSON of the form `{ "error": "A message for the user" }` with a 4xx or 5xx status.
- Money is a whole number of Sri Lankan rupees.
- Admin endpoints need the `am_admin` cookie set by the login endpoint. Without it they answer 401 with "Please log in again."

## Public endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/store` | Public settings and visible products |
| GET | `/api/images/:id` | One product photo |
| POST | `/api/orders` | Place an order |
| GET | `/api/orders/:no?key=...` | Read one order |
| POST | `/api/orders/:no/pay` | Start another card payment attempt |
| POST | `/api/payhere/notify` | Payment notification, called by PayHere |

### GET /api/store

Returns everything the storefront needs.

```
{
  "settings": {
    "store_name": "Amethia",
    "announcement": "...",
    "whatsapp": "94770000000",
    "instagram": "amethia.lk",
    "facebook": "amethia.lk",
    "tiktok": "amethia.lk",
    "email": "hello@amethia.lk",
    "delivery_fee": "400",
    "free_delivery_over": "10000",
    "cod_enabled": "1"
  },
  "cardPayments": false,
  "products": [ Product, ... ]
}
```

Only products with "Show in shop" switched on are included. `cardPayments` is true when the PayHere keys are set. Setting values are strings.

A `Product` looks like this:

```
{
  "id": "iris-dress",
  "name": "Iris Dress",
  "category": "dresses",
  "type": "dress",
  "price": 6500,
  "badge": "First design",
  "intro": "...",
  "description": "...",
  "fabric": "...",
  "colors": [["Royal Amethyst", "#6A2C91"], ["Deep Plum", "#4A1F5C"]],
  "sizes": ["XS", "S", "M", "L", "XL"],
  "active": true,
  "soldOut": false,
  "sort": 0,
  "images": [3, 4]
}
```

`images` is a list of photo IDs for use with `/api/images/:id`. It is empty when the product has no photos, in which case the pages show a drawing based on `type`.

### GET /api/images/:id

Returns the photo itself with its image content type. Answers 404 when the ID does not exist.

### POST /api/orders

Places an order. Request body:

```
{
  "customer": {
    "firstName": "Nimali",
    "lastName": "Perera",
    "email": "nimali@example.com",
    "phone": "0771234567",
    "address": "12 Lake Road",
    "city": "Kandy",
    "district": "Kandy",
    "notes": ""
  },
  "paymentMethod": "cod",
  "items": [
    { "id": "iris-dress", "color": "Deep Plum", "size": "M", "qty": 1 }
  ]
}
```

Rules:

- `district` and `notes` are optional. The other customer fields are required.
- The phone number must contain 9 to 15 digits.
- `paymentMethod` is `card` or `cod`. `card` is refused while PayHere is not configured. `cod` is refused when cash on delivery is switched off in the settings.
- An order can have up to 30 lines, each with a quantity from 1 to 10. Lines with the same product, colour and size are merged, up to 10.
- Each product must be visible and not sold out, and the colour and size must be ones the product offers.

Reply:

```
{ "orderNo": "AM1001", "key": "pX3...", "total": 6900 }
```

For a card order the reply also has a `payhere` object with `action` (the PayHere address) and `fields` (the form fields to post there). The storefront builds a hidden form from it and submits it.

### GET /api/orders/:no

Needs the order's key as `?key=...`. A wrong or missing key gets the same 404 as an unknown order.

```
{
  "orderNo": "AM1001",
  "firstName": "Nimali",
  "paymentMethod": "cod",
  "paymentStatus": "unpaid",
  "status": "new",
  "subtotal": 6500,
  "delivery": 400,
  "total": 6900,
  "createdAt": "2026-10-02 05:10:44",
  "items": [
    { "product_id": "iris-dress", "name": "Iris Dress", "color": "Deep Plum", "size": "M", "qty": 1, "unit_price": 6500 }
  ]
}
```

Times are in UTC.

### POST /api/orders/:no/pay

Starts a new payment attempt for an unpaid card order. Body: `{ "key": "..." }`. Reply: `{ "payhere": { "action": "...", "fields": { ... } } }`.

It answers 400 when the order is cash on delivery, already paid or cancelled, or when PayHere is not configured.

### POST /api/payhere/notify

Called by PayHere's servers, not by the browser. The body is form-encoded. The reply is plain text.

| Reply | When |
|---|---|
| 200 `OK` | The notification was accepted |
| 400 `Invalid signature` | The signature does not match, or PayHere is not configured |
| 400 `Amount mismatch` | The currency is not LKR or the amount differs from the order total |
| 404 `Unknown order` | No order has that number |

Details are in [05 Payments](05-payments.md).

## Admin endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/login` | Log in |
| POST | `/api/admin/logout` | Log out |
| GET | `/api/admin/me` | Check the session and get the PayHere mode |
| GET | `/api/admin/orders` | List orders with a summary |
| GET | `/api/admin/orders/:id` | One order with items and payment history |
| PATCH | `/api/admin/orders/:id` | Change order or payment status |
| GET | `/api/admin/products` | All products plus the allowed categories, types and sizes |
| POST | `/api/admin/products` | Create a product |
| PUT | `/api/admin/products/:id` | Update a product |
| DELETE | `/api/admin/products/:id` | Delete a product and its photos |
| POST | `/api/admin/products/:id/images` | Add a photo |
| POST | `/api/admin/images/:id/first` | Make a photo the first one |
| DELETE | `/api/admin/images/:id` | Delete a photo |
| GET | `/api/admin/settings` | Read all store settings |
| PUT | `/api/admin/settings` | Save store settings |

### Login, logout and session

`POST /api/admin/login` takes `{ "password": "..." }` and replies `{ "ok": true }` with the session cookie.

| Status | Meaning |
|---|---|
| 401 | Wrong password |
| 429 | Too many attempts. Wait 15 minutes. |
| 503 | `ADMIN_PASSWORD` is not set in `.env` |

`POST /api/admin/logout` clears the cookie. It does not need a session.

`GET /api/admin/me` replies `{ "ok": true, "payhere": { "enabled": false, "sandbox": true } }`.

### Orders

`GET /api/admin/orders` accepts three optional query parameters:

| Parameter | Meaning |
|---|---|
| `status` | One order status: `new`, `processing`, `shipped`, `delivered` or `cancelled` |
| `payment` | One payment status: `unpaid`, `pending`, `paid`, `failed`, `cancelled`, `chargeback` or `refunded` |
| `q` | Text to find in the order number, customer name, phone or email |

The reply has `orders`, the newest 300 matching rows from the `orders` table each with an extra `item_count`, and `summary`:

```
{ "toProcess": 2, "awaitingPayment": 1, "paidThisMonth": 19400, "ordersThisMonth": 5 }
```

`GET /api/admin/orders/:id` uses the numeric `id`, not the order number. It returns the order row plus `items` and `payments`. Each entry in `payments` is one PayHere notification: `valid`, `at`, `status`, `method`, `message` and `paymentId`.

`PATCH /api/admin/orders/:id` takes `{ "status": "...", "paymentStatus": "..." }`. Either field may be left out to keep its current value.

### Products

The body for `POST /api/admin/products` and `PUT /api/admin/products/:id`:

| Field | Rule |
|---|---|
| `name` | Required, up to 80 characters |
| `id` | The link name. Lowercase letters, numbers and dashes, 2 to 60 characters. Made from the name when left out. Cannot be changed after creation. |
| `category` | `dresses`, `tops`, `bottoms` or `coords` |
| `type` | The drawing style: `dress`, `maxi`, `slip`, `top`, `blouse`, `skirt`, `pants` or `coord` |
| `price` | Whole number from 0 to 10,000,000 |
| `badge` | Optional, up to 30 characters |
| `intro` | Optional, up to 300 characters |
| `description` | Optional, up to 2000 characters |
| `fabric` | Optional, up to 1000 characters |
| `colors` | 1 to 8 pairs of `[name, "#RRGGBB"]` with different names |
| `sizes` | At least one of `XS`, `S`, `M`, `L`, `XL`, `XXL`, `Free size` |
| `active` | True to show the product in the shop |
| `soldOut` | True to mark it sold out |
| `sort` | Whole number from -10000 to 10000. Lower numbers appear first. |

Both endpoints reply with the saved `Product`.

### Photos

`POST /api/admin/products/:id/images` takes `{ "data": "data:image/jpeg;base64,..." }`. JPEG, PNG and WebP are accepted, up to 5 MB each after decoding. The reply is `{ "id": 7 }`.

### Settings

`PUT /api/admin/settings` takes all of these fields and replies with the saved settings.

| Field | Rule |
|---|---|
| `store_name` | Required, up to 60 characters |
| `announcement` | Optional, up to 160 characters |
| `whatsapp` | Required. Number with country code, at least 9 digits, for example 94771234567. |
| `instagram`, `tiktok` | Optional account names. A leading `@` is removed. |
| `facebook` | Optional page name |
| `email` | Optional |
| `delivery_fee` | Whole number from 0 to 100,000 |
| `free_delivery_over` | Whole number from 0 to 10,000,000. 0 means delivery is never free. |
| `cod_enabled` | True to offer cash on delivery |
