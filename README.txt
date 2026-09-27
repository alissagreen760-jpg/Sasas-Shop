SASA'S SHOP - SETUP (Stripe checkout)

Checkout runs on a small Netlify Function, and drag-and-drop deploys can't run those.
So this version goes online through GitHub instead. Bonus: after setup, you can mark
things sold right from GitHub's website and the site updates by itself.

1. PUT THE FILES ON GITHUB
   - Make a free account at github.com
   - Click "+" (top right) > New repository. Name it sasas-shop. Click Create.
   - Click "uploading an existing file".
   - Unzip this folder, open it, select EVERYTHING inside (including the "netlify"
     folder), and drag it all onto the GitHub page. Click "Commit changes".
   - Check that you see netlify/functions/checkout.mjs in the repo.

2. CONNECT IT TO NETLIFY
   - In Netlify: Add new project > Import an existing project > GitHub > pick sasas-shop.
   - Leave the build command empty. Click Deploy.
   - You get a new address like something.netlify.app (rename it in Site settings).

3. ADD YOUR STRIPE KEY (TEST MODE FIRST)
   - In Stripe (Test mode on): Developers > API keys > copy the Secret key (starts sk_test_).
   - In Netlify: Site configuration > Environment variables > Add a variable
       Key:   STRIPE_SECRET_KEY
       Value: your sk_test_ key
   - Deploys > Trigger deploy > Deploy site.
   - NEVER paste the secret key into any file or send it to anyone.

4. TEST AN ORDER
   - Add something to your bag and check out.
   - Card 4242 4242 4242 4242, any future date, any CVC, any ZIP.
   - You should land on the thank-you page, and the order shows in Stripe > Payments.

5. GO LIVE
   - In Stripe, finish account activation (bank info), switch off Test mode,
     copy the LIVE secret key (sk_live_...).
   - Replace STRIPE_SECRET_KEY in Netlify with it, then Trigger deploy again.

WHEN SOMETHING SELLS
   - On your site: Stripe emails you. The order shows the item(s) under "Metadata".
   - Go to your repo on GitHub > products.js > pencil icon (edit).
   - Find the item (Ctrl+F / Cmd+F), change "sold": false to "sold": true, Commit.
   - Netlify updates the site in about a minute. Also mark it sold in Vendoo.
   - Sold on Depop/Poshmark/eBay? Do the same so nobody buys it on your site.

SHIPPING
   Currently $6 flat, free at $75+. To change it, edit the numbers at the top of BOTH
   shop.js and netlify/functions/checkout.mjs.

FILES
   index.html      the page design
   shop.js         browsing + bag
   products.js     your pieces, one per line
   thanks.html     thank-you page after paying
   netlify/functions/checkout.mjs   sends shoppers to Stripe with the right prices
