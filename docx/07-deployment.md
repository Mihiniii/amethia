# Deployment

This guide covers putting the shop on the public internet.

## What the host must provide

- **It can run Node.js 22.13 or newer** as a long-running process.
- **It keeps files between restarts.** Products, photos, orders and settings all live in `data/shop.db`. A host that wipes the disk on each deploy would lose them.
- **HTTPS.** PayHere live payments require it, and the admin cookie is marked secure only on an `https://` address.

Free static hosts such as Netlify or GitHub Pages cannot run the shop, because it has a backend.

## Hosting options

| Option | Notes |
|---|---|
| A small VPS (DigitalOcean, Hetzner, Hostinger VPS or a Sri Lankan provider) | Cheapest over time and gives full control |
| Railway | Add a Volume and set `DB_PATH` to a path inside it |
| Render | Needs a paid instance with a Persistent Disk. Set `DB_PATH` to a path on that disk. |

## Steps on a VPS

1. Install Node.js 22.13 or newer.
2. Upload the project folder without `data/` and without `.env`.
3. Create `.env` on the server with real values, as shown below.
4. Keep the shop running with a process manager.
5. Put Caddy or Nginx in front of it for HTTPS.
6. Point your domain at the server.

A production `.env`:

```
PORT=3000
SITE_URL=https://amethia.lk
ADMIN_PASSWORD=a-long-unique-password
SESSION_SECRET=a-long-random-string-of-32-or-more-characters
PAYHERE_MERCHANT_ID=your-live-merchant-id
PAYHERE_MERCHANT_SECRET=your-live-merchant-secret
PAYHERE_SANDBOX=false
DB_PATH=./data/shop.db
```

Start it with pm2 so that it restarts after a crash or reboot:

```
pm2 start npm --name amethia -- start
pm2 save
```

A complete Caddy configuration, which also obtains the HTTPS certificate automatically:

```
amethia.lk {
    reverse_proxy localhost:3000
}
```

The reverse proxy passes the visitor's address to the shop in the `X-Forwarded-For` header, which the admin login limit relies on. Do not expose port 3000 directly to the internet.

## Backups

Everything is in the database file, so a backup is a copy of that file.

- Copy `data/shop.db` somewhere off the server at least once a day.
- If you copy while the server is running, include `shop.db-wal` and `shop.db-shm`.
- To restore, stop the server, put the files back and start it again.
- Keep a copy of `.env` in a private place too. It is not in the database.

## Updating the shop

1. Back up `data/shop.db`.
2. Upload the new code files, leaving `data/` and `.env` in place.
3. Restart, for example with `pm2 restart amethia`.

New database tables are created automatically at startup. A change to an existing table's columns has to be applied by hand.

## Launch checklist

- `ADMIN_PASSWORD` is long, unique and not used anywhere else.
- `SESSION_SECRET` is a long random string.
- `SITE_URL` is the real `https://` address with no trailing slash.
- The sample products are edited or deleted.
- The WhatsApp number, email and social accounts in the admin settings are real. The defaults are placeholders.
- The delivery fee and free-delivery amount are correct.
- The live PayHere keys are in place, `PAYHERE_SANDBOX=false`, and the startup output says `PayHere: LIVE`.
- One real low-value card order has been placed and shows as **Paid**.
- A backup has been taken and restored once as a test.
