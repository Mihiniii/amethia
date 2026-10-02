# Admin guide

The admin panel is where you handle orders, manage products and photos, and change store settings. No coding is needed.

## Logging in

Open `/admin` on your shop's address, for example http://localhost:3000/admin, and enter the admin password.

- The password is the `ADMIN_PASSWORD` value in the `.env` file. To change it, edit that file and restart the server.
- A login lasts 12 hours.
- After 5 wrong passwords, logins are blocked for 15 minutes.

A badge at the top shows the payment mode: PayHere off, test mode or live.

## Orders

The Orders view opens first. Four figures at the top summarise the shop:

| Figure | Meaning |
|---|---|
| To make & ship | Orders that are New or Being made and are ready to work on: cash on delivery orders and paid card orders |
| Card not paid yet | Card orders that have not been paid |
| Orders this month | Orders placed this calendar month, not counting cancelled ones |
| Paid this month | Total value of orders paid this calendar month |

You can filter the list by order status and payment status, and search by order number, customer name, phone number or email. The list shows the newest 300 matching orders.

### Working on an order

Click an order to see the customer's contact details, delivery address, note, items and the messages received from PayHere. The phone number has a WhatsApp link for contacting the customer.

Choose the new order status or payment status and press **Save changes**.

Move the order through these steps as you go:

1. **New**: the order has just arrived.
2. **Being made**: you have started on it.
3. **Shipped**: it is with the courier.
4. **Delivered**: the customer has it.

Use **Cancelled** for an order that will not be completed. The customer sees these steps on their order page.

### Payment rules

- **Card orders** change to **Paid** automatically when PayHere confirms the payment. Do not start making a card order until it shows **Paid**.
- **Cash on delivery orders** start as **Unpaid (COD)** and can be made straight away. Set the payment to **Paid** once the courier has given you the money.
- If you refund a customer through PayHere or by bank transfer, set the payment to **Refunded** yourself. The shop does not send refunds.
- A **Chargeback** means the customer's bank reversed the payment. PayHere sets this status.

## Products

The Products view lists every product, including hidden ones. Each one is labelled **On sale** or **Hidden**, plus **Sold out** or **Sample** where that applies.

### Adding or editing a product

Press **Add product**, or click a product to edit it.

| Field | What to enter |
|---|---|
| Name | The product name shown in the shop |
| Price (LKR) | Price in rupees, as a whole number |
| Badge | Optional small label, such as "New" or "Bestseller" |
| Category | Dresses, Tops, Skirts & pants or Co-ord sets |
| Drawing shown until photos are added | Which garment drawing stands in for the photos |
| Short intro, Description, Fabric & care | The text on the product page |
| Colours | 1 to 8 colours, each with its own name |
| Sizes available | The sizes you offer for this product |
| Show in shop | Untick to hide the product without deleting it |
| Sold out | Customers can see the product but cannot order it |
| Position in shop | Products with lower numbers show first |

The product's web address is made from its name when you first add it, for example "Iris Dress" becomes `iris-dress`. Renaming the product later does not change that address.

### Photos

- Add the product first, then upload its photos.
- JPG, PNG and WebP files are accepted. Portrait photos with a 3:4 shape look best.
- Photos are resized automatically before upload, so large phone photos are fine.
- The main photo is the one shown in the shop grid. Press **Make main** on another photo to change it.
- A product with no photos shows a drawing in its first colour.

### Deleting a product

Press **Delete**, then **Yes, delete for good**. This also deletes the product's photos and cannot be undone. Past orders keep the product's name and price. To take a product off the shop for a while, untick "Show in shop" instead.

### Before launch

Seven of the eight starter products are samples with the badge "Sample". Edit them into real products or delete them.

## Settings

| Setting | Effect |
|---|---|
| Store name | Saved with the settings. The shop pages do not read it yet: the name "Amethia" shown to customers is written in the page files. |
| Announcement bar | The line of text at the top of every page. Leave it empty to hide the bar. |
| WhatsApp number with country code | Used for the "message us" links. Digits only, for example 94771234567. |
| Email | Contact email shown on the help page |
| Instagram username, TikTok username, Facebook page name | Account names for the social links |
| Delivery fee (LKR) | Added to every order below the free-delivery amount |
| Free delivery over (LKR) | Orders at or above this amount have free delivery. Enter 0 to always charge the fee. |
| Offer cash on delivery | Untick to accept card payments only |

Press **Save settings**. Changes take effect for customers the next time they load the shop.

## What is not in the admin panel

- The admin password and PayHere keys are set in the `.env` file. See [01 Getting started](01-getting-started.md).
- Page text such as the home page headline, "Our story", the FAQ and the size chart is in `public/shop.js`. Colours and fonts are at the top of `public/shop.css`.
- The shop does not send emails or messages. Contact customers yourself, using the phone number and email on the order.
- Stock is not counted. Mark a product **Sold out** when you can no longer make it.
