# Database

The shop stores everything in one SQLite file, `data/shop.db` by default. It holds products, photos, orders, the payment log and the store settings. The location can be changed with `DB_PATH` in `.env`.

The file is opened with Node's built-in `node:sqlite` module. Write-ahead logging is on, so two extra files, `shop.db-wal` and `shop.db-shm`, appear next to it while the server runs. Foreign keys are enforced.

Tables are created by `lib/db.js` at startup if they do not exist yet.

## What SQLite is and how the shop uses it

SQLite is a database that lives in a single file. Unlike MySQL or PostgreSQL, there is no separate database server to install, start or log in to. The shop's own process reads and writes the file directly.

- **No install needed.** Node.js 22.13 and newer has SQLite built in, which is why the project has no packages.
- **Created automatically.** `lib/db.js` opens the file at startup, creates the tables if they are missing, adds the default settings, and adds 8 starter products when the shop is empty.
- **Queried with plain SQL.** `server.js` runs prepared statements, as in the example below. The `?` placeholders keep user input out of the SQL text, which prevents SQL injection.
- **Changes that belong together are grouped.** Saving an order and its lines happens inside one transaction, using the `tx` helper in `lib/db.js`. If any step fails, nothing is saved.
- **Not uploaded to GitHub.** The `data` folder is listed in `.gitignore`, so customer data stays on the machine that runs the shop.

```
const order = db.prepare("SELECT * FROM orders WHERE order_no = ?").get("AM1001");
const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
```

`.get()` returns one row, `.all()` returns a list of rows, and `.run()` is used for inserts, updates and deletes.

## Tables

| Table | Holds |
|---|---|
| `products` | One row per product |
| `images` | Product photos, stored inside the database |
| `orders` | One row per order, with the customer's details and totals |
| `order_items` | The lines of each order |
| `payment_log` | Every notification received from PayHere |
| `settings` | Store settings as name and value pairs |

## How the tables relate

| Relationship | Type | What happens on delete |
|---|---|---|
| `products` to `images` | One product has many photos | Deleting a product deletes its photos |
| `orders` to `order_items` | One order has many lines | Deleting an order deletes its lines |
| `order_items` to `products` | A line records which product was bought, without a database link | Deleting a product leaves past order lines unchanged |
| `payment_log` to `orders` | A log entry holds the order number as text, without a database link | Log entries are kept |

`settings` stands alone.

## Design choices

- **Money is whole rupees.** Prices and totals are integers, which avoids decimal rounding errors.
- **Colours and sizes are JSON text.** A product's colours, for example `[["Deep Plum","#4A1F5C"]]`, sit in one column instead of in separate tables. This keeps the schema small, at the cost of not being able to search by colour in SQL.
- **Photos are stored in the database.** A backup of the one file therefore includes every photo.
- **Order lines copy the product's name and price.** Past orders stay correct after a product is edited or deleted.
- **Order numbers come from the row ID.** `AM` followed by 1000 plus the ID.
- **Dates are UTC text**, in the form `2026-10-02 05:10:44`.
- **Categories, sizes and statuses are not tables.** The allowed values are lists in `server.js`, checked before anything is saved.

## Table details

### products

| Column | Type | Notes |
|---|---|---|
| `id` | text, primary key | The link name, for example `iris-dress` |
| `name` | text | |
| `category` | text | `dresses`, `tops`, `bottoms` or `coords` |
| `type` | text | Drawing style used when there is no photo |
| `price` | integer | Whole rupees |
| `badge` | text | Small label such as "Sample" |
| `intro` | text | Short introduction |
| `description` | text | |
| `fabric` | text | Fabric and care text |
| `colors` | text | JSON list of `[name, hex]` pairs |
| `sizes` | text | JSON list of size names |
| `active` | integer | 1 shows the product in the shop |
| `sold_out` | integer | 1 marks it sold out |
| `sort` | integer | Display order, lowest first |
| `created_at` | text | UTC time |

### images

| Column | Type | Notes |
|---|---|---|
| `id` | integer, primary key | Used in `/api/images/:id` |
| `product_id` | text | Refers to `products.id`. Deleting the product deletes its photos. |
| `mime` | text | `image/jpeg`, `image/png` or `image/webp` |
| `data` | blob | The photo itself |
| `sort` | integer | Display order, lowest first |

### orders

| Column | Type | Notes |
|---|---|---|
| `id` | integer, primary key | Internal number, used by the admin API |
| `order_no` | text, unique | Shown to the customer. `AM` followed by 1000 plus `id`, so the first order is `AM1001`. |
| `access_key` | text | Random key the customer needs to view the order |
| `first_name`, `last_name`, `email`, `phone` | text | Customer contact details |
| `address`, `city`, `district` | text | Delivery address. `district` may be empty. |
| `notes` | text | Customer's note, may be empty |
| `payment_method` | text | `card` or `cod` |
| `payment_status` | text | See the list below |
| `status` | text | See the list below. Starts as `new`. |
| `subtotal`, `delivery`, `total` | integer | Whole rupees, computed by the server |
| `pay_attempts` | integer | Number of card payment attempts started |
| `payment_ref` | text | PayHere payment ID |
| `payment_info` | text | Payment method and status message from PayHere |
| `created_at`, `updated_at` | text | UTC times |

### order_items

| Column | Type | Notes |
|---|---|---|
| `id` | integer, primary key | |
| `order_id` | integer | Refers to `orders.id`. Deleting the order deletes its lines. |
| `product_id` | text | Product ID at the time of the order. Not a foreign key. |
| `name` | text | Product name at the time of the order |
| `color`, `size` | text | |
| `qty` | integer | 1 to 10 |
| `unit_price` | integer | Price at the time of the order |

An order line keeps its own copy of the product name and price. Editing or deleting a product later does not change past orders.

### payment_log

| Column | Type | Notes |
|---|---|---|
| `id` | integer, primary key | |
| `order_no` | text | Order number taken from the notification |
| `valid` | integer | 1 when the signature was correct |
| `payload` | text | The whole notification as JSON |
| `created_at` | text | UTC time |

Every notification is logged, including rejected ones. This is the first place to look when a payment did not update an order.

### settings

| Column | Type | Notes |
|---|---|---|
| `key` | text, primary key | Setting name |
| `value` | text | Always stored as text |

| Key | Default value |
|---|---|
| `store_name` | Amethia |
| `announcement` | Island-wide delivery · Cash on delivery · Free delivery over LKR 10,000 |
| `whatsapp` | 94770000000 |
| `instagram`, `facebook`, `tiktok` | amethia.lk |
| `email` | hello@amethia.lk |
| `delivery_fee` | 400 |
| `free_delivery_over` | 10000 |
| `cod_enabled` | 1 |

Defaults are added only for keys that are missing, so values changed in the admin panel are kept across restarts.

## Statuses

Order status, in the order an order normally moves through them:

| Value | Shown in the admin panel as |
|---|---|
| `new` | New |
| `processing` | Being made |
| `shipped` | Shipped |
| `delivered` | Delivered |
| `cancelled` | Cancelled |

Payment status:

| Value | Shown as | Set by |
|---|---|---|
| `unpaid` | Unpaid (COD) | A new cash on delivery order |
| `pending` | Awaiting payment | A new card order, or a new payment attempt |
| `paid` | Paid | PayHere, or the admin for cash on delivery |
| `failed` | Failed | PayHere |
| `cancelled` | Cancelled | PayHere, when the customer cancels on the payment page |
| `chargeback` | Chargeback | PayHere |
| `refunded` | Refunded | The admin only |

## Delivery fee

The delivery fee for an order is the `delivery_fee` setting. It is 0 when the subtotal reaches `free_delivery_over`, unless that setting is 0, which switches free delivery off.

## Starter products

When the `products` table is empty at startup, 8 products are added: the Iris Dress and seven samples. Deleting every product and restarting adds them again.

## Looking inside the database

Any SQLite tool can open the file, for example DB Browser for SQLite or the `sqlite3` command:

```
sqlite3 data/shop.db "SELECT order_no, total, payment_status, status FROM orders ORDER BY id DESC LIMIT 10;"
```

Stop the server before editing the file by hand.

## Backups

Copy `data/shop.db` to a safe place regularly. If the server is running, copy the `-wal` and `-shm` files with it, or stop the server first so that everything is in the one file.
