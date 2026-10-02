# Amethia shop documentation

Amethia is an online clothing store: a storefront, a checkout with PayHere card payments and cash on delivery, and an admin panel. It runs on Node.js 22.13 or newer with no packages to install, and keeps all its data in one SQLite file.

Every guide is provided twice: as Markdown (`.md`) and as a Word document (`.docx`) with the same content.

## Guides

| Guide | What it covers | Read it if you |
|---|---|---|
| [01 Getting started](01-getting-started.md) | Running the shop on your computer, the `.env` settings, common errors | are running the project for the first time |
| [02 Architecture](02-architecture.md) | Files, how a request is handled, how the storefront and admin pages work, security | want to understand or change the code |
| [03 API reference](03-api-reference.md) | Every `/api/...` endpoint with its inputs and outputs | are working on the frontend or testing the backend |
| [04 Database](04-database.md) | Tables, columns, statuses, starter data | need to read or change stored data |
| [05 Payments](05-payments.md) | The PayHere flow, signatures, sandbox testing, going live | are setting up or debugging card payments |
| [06 Admin guide](06-admin-guide.md) | Using the admin panel for orders, products and settings | run the shop day to day |
| [07 Deployment](07-deployment.md) | Hosting, HTTPS, backups, a launch checklist | are putting the shop online |

## Quick start

```
cd amethia-shop
copy .env.example .env
npm start
```

Edit `.env` first and set `ADMIN_PASSWORD` and `SESSION_SECRET`. Then open http://localhost:3000 for the shop and http://localhost:3000/admin for the admin panel. The full steps are in [01 Getting started](01-getting-started.md).

## Project at a glance

| Item | Value |
|---|---|
| Language | Plain JavaScript (Node.js backend, no framework; browser JavaScript frontend, no build step) |
| Node.js version | 22.13 or newer |
| External packages | None |
| Database | SQLite through Node's built-in `node:sqlite`, stored in `data/shop.db` |
| Payments | PayHere checkout (cards and mobile wallets), cash on delivery |
| Currency | Sri Lankan rupees (LKR), stored as whole numbers |
| Default port | 3000 |
