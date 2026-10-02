# Getting started

This guide takes you from a fresh copy of the project to a running shop on your own computer.

## What you need

- **Node.js 22.13 or newer.** Check with `node -v`. Download it from https://nodejs.org if it is missing or older.
- Nothing else. There is no `npm install` step, because the project uses only what ships with Node.js.

## Run the shop

1. Open a terminal in the project folder, the one that contains `package.json` and `server.js`.
2. Copy the example settings file.
3. Open `.env` in an editor and set `ADMIN_PASSWORD` and `SESSION_SECRET`.
4. Start the server with `npm start`.
5. Open http://localhost:3000 for the shop and http://localhost:3000/admin for the admin panel.

On Windows:

```
copy .env.example .env
npm start
```

On Mac or Linux:

```
cp .env.example .env
npm start
```

A successful start prints:

```
Amethia shop running at http://localhost:3000  (admin: http://localhost:3000/admin)
PayHere: off
```

Keep the terminal open while you use the shop. Press `Ctrl+C` to stop it.

## Commands

| Command | What it does |
|---|---|
| `npm start` | Starts the server |
| `npm run dev` | Starts the server and restarts it whenever a file changes |

## Settings in .env

Settings are lines of the form `NAME=value` inside the `.env` file. They are not terminal commands. The server reads the file once at startup, so restart after every change.

| Setting | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `SITE_URL` | `http://localhost:3000` | Public address of the site, without a trailing slash. PayHere return and notify links are built from it. |
| `ADMIN_PASSWORD` | none | Password for `/admin`. The admin panel stays locked while this is empty or still `change-this-password`. |
| `SESSION_SECRET` | none | Long random text used to sign admin logins. Must be at least 16 characters. |
| `PAYHERE_MERCHANT_ID` | empty | PayHere Merchant ID. Card payments are off while this or the secret is empty. |
| `PAYHERE_MERCHANT_SECRET` | empty | PayHere Merchant Secret for your domain |
| `PAYHERE_SANDBOX` | `true` | `true` sends payments to the PayHere sandbox. `false` takes real payments. |
| `DB_PATH` | `./data/shop.db` | Where the database file is stored |

A value already set in the real environment wins over the same name in `.env`. This lets a hosting provider supply the settings without a `.env` file.

Never share or upload `.env`. It is listed in `.gitignore`.

## What the first start does

- Creates the `data` folder and the database file `data/shop.db`.
- Adds the default store settings, such as the delivery fee and the WhatsApp number.
- Adds 8 starter products. Only the Iris Dress is a real design. The other seven carry the badge "Sample" and should be edited or deleted in the admin panel before launch.

To start again from an empty shop, stop the server and delete the `data` folder. The next start recreates it.

## Startup messages

These lines are warnings. The server still runs.

| Message | Meaning | Fix |
|---|---|---|
| `Set ADMIN_PASSWORD in .env before going live` | The admin password is empty or still the example value, so admin login is refused | Set `ADMIN_PASSWORD` in `.env` and restart |
| `SESSION_SECRET is missing or short` | A temporary secret is used, so admins are logged out at every restart | Set `SESSION_SECRET` to at least 16 characters and restart |
| `PayHere is not configured` | Card payments are switched off. Cash on delivery still works. | Add the PayHere keys, described in [05 Payments](05-payments.md) |

The last line of the startup output shows the payment mode: `PayHere: off`, `PayHere: sandbox (test payments)` or `PayHere: LIVE`.

## Common errors

| What you see | Cause | Fix |
|---|---|---|
| `npm error enoent Could not read package.json` | The terminal is in the wrong folder | `cd` into the folder that contains `package.json` and run `npm start` again |
| `The term 'ADMIN_PASSWORD=...' is not recognized` | A setting was typed into the terminal | Put the line in the `.env` file instead |
| `Error: listen EADDRINUSE: address already in use :::3000` | Another program, or an earlier copy of the shop, is using port 3000 | Stop the other copy, or change `PORT` and `SITE_URL` in `.env` |
| `Cannot find module 'node:sqlite'` | Node.js is older than 22.13 | Install a newer Node.js |
| Admin login says "Set ADMIN_PASSWORD in the .env file first" | The password is still the example value, or the server was not restarted | Set the password and restart |
| Admin login says "Too many attempts" | Five wrong passwords from the same address | Wait 15 minutes, or restart the server |
