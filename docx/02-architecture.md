# Architecture

Amethia is one Node.js process. It serves the storefront and admin pages as static files, answers a JSON API under `/api/`, and stores everything in one SQLite file. There is no framework, no build step and no external package.

## Files

| File | Role |
|---|---|
| `server.js` | The HTTP server: routing, input checks, orders, admin login, static files |
| `lib/config.js` | Reads `.env` and builds the settings object. Prints the startup warnings. |
| `lib/db.js` | Opens the database, creates the tables, adds default settings and starter products |
| `lib/payhere.js` | Builds the PayHere checkout form and verifies PayHere notifications |
| `public/index.html` | The storefront page shell |
| `public/shop.js` | Storefront logic: pages, bag, checkout, order page |
| `public/shop.css` | Styles for both the storefront and the admin panel |
| `public/garments.js` | Drawings shown for products that have no photo yet |
| `public/admin.html` | The admin panel page shell |
| `public/admin.js` | Admin panel logic: orders, products, photos, settings |
| `data/shop.db` | The database, created on first start |
| `.env` | Private settings, created by you from `.env.example` |

## How a request is handled

Every request enters the single handler at the bottom of `server.js`.

1. If the path starts with `/api/`, the server looks for a route with the same method and a matching pattern. Routes are registered with the `route(method, pattern, handler, options)` helper, and `:name` parts of a pattern become parameters.
2. If the route is marked `admin`, the request must carry a valid admin cookie. Otherwise the server answers 401.
3. The handler runs. Whatever it returns is sent as JSON with status 200. A handler can also write the response itself, as the image and PayHere routes do.
4. If no API route matches, the answer is 404.
5. Any other path is a static file request and only `GET` and `HEAD` are allowed.

Handlers report problems by calling `fail(status, message)`, which throws an `HttpError`. The top-level handler turns it into a JSON reply of the form `{ "error": "message" }`. Any other exception is logged and answered with a generic 500 message.

## Static files and pages

| Path | What is served |
|---|---|
| `/` | `public/index.html` |
| `/order/...` | `public/index.html`, which then shows the order page |
| `/admin` | `public/admin.html`, with a header that forbids framing |
| a file that exists in `public/` | that file |
| anything else | `public/index.html`, so unknown addresses show the shop |

HTML is sent with `no-cache`. Other static files are cached for one hour. Product photos served from the database are cached for one year, because a photo never changes once it has an ID.

## The storefront

`public/shop.js` is a small single-page app with no framework. On load it calls `GET /api/store` once to get the public settings and the visible products, then draws pages by setting the HTML of the `#app` element.

Pages are chosen by the part of the address after `#`:

| Address | Page |
|---|---|
| `/#home` or `/` | Home |
| `/#shop` | All products |
| `/#shop-dresses`, `/#shop-tops`, `/#shop-bottoms`, `/#shop-coords` | One category |
| `/#p-<product id>` | Product page |
| `/#about` | Our story |
| `/#help` | Help and FAQ |
| `/#checkout` | Checkout |
| `/order/<order number>/<key>` | Order status page |
| `/order/<order number>/<key>/cancelled` | Order status page after a cancelled payment |

The shopping bag is kept in the browser's `localStorage` under the key `amethia-bag`. Each line holds a product ID, colour, size and quantity. Prices in the bag are for display only: the server looks up the real prices when the order is placed.

While a card payment is pending, the order page asks the server for the order again every 3 seconds, up to 40 times, and then tells the customer to get in touch.

## The admin panel

`public/admin.js` is a second small single-page app. It calls `GET /api/admin/me` first. If that fails with 401 it shows the login form, otherwise it shows three views: Orders, Products and Settings.

Photos are resized in the browser before upload, to at most 1600 pixels on the longer side, and converted to JPEG. They are then sent as base64 text inside a JSON body and stored in the database.

## Admin login

- There is one admin, identified only by the password in `ADMIN_PASSWORD`. There are no user accounts.
- A correct password sets a cookie named `am_admin`. Its value is an expiry time plus an HMAC-SHA256 signature made with `SESSION_SECRET`.
- The cookie lasts 12 hours and is `HttpOnly` and `SameSite=Strict`. It is also `Secure` when `SITE_URL` starts with `https://`.
- Sessions are not stored on the server. Logging out clears the cookie in the browser. Changing `SESSION_SECRET` and restarting ends every session.
- After 5 wrong passwords from one address, logins from that address are refused for 15 minutes. The counter is kept in memory, so a restart clears it.

## Security measures

- **Prices come from the server.** An order request only names product IDs, colours, sizes and quantities. The server reads prices from the database and computes the subtotal, delivery fee and total itself.
- **Order pages need a secret key.** Each order gets a random access key. A customer can read or retry an order only with both the order number and that key.
- **PayHere messages are verified.** The signature is checked with the Merchant Secret, and the currency and amount must match the order.
- **Inputs are checked.** Text fields have length limits, numbers have ranges, and request bodies have size limits.
- **Constant-time comparisons** are used for the admin password, session signatures, order keys and PayHere signatures.
- **File paths are confined** to the `public` folder, so a crafted address cannot read other files.
- **SQL uses prepared statements** with parameters throughout.

## Things to know before changing the code

- The lists of categories, garment types, sizes, order statuses and payment statuses are constants at the top of `server.js`. The storefront and admin panel have their own display names for them in `public/shop.js` and `public/admin.js`, so a new value must be added in each place.
- Product categories and types are fixed lists. They are not stored in a database table.
- The server trusts the `X-Forwarded-For` header for the login limit. This is correct behind a reverse proxy such as Caddy or Nginx. Without a proxy, a client can set that header itself.
- The database is opened by `lib/db.js` when the module is first loaded, and table creation uses `CREATE TABLE IF NOT EXISTS`. There is no migration system, so changing a column on an existing database needs a manual `ALTER TABLE`.
