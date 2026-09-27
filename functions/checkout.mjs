// Creates a Stripe Checkout page for the items in the shopper's bag.
// Prices always come from products.js on your site, never from the shopper's browser.
// Needs one environment variable in Netlify: STRIPE_SECRET_KEY

// Keep these two numbers in sync with shop.js
const SHIPPING_CENTS = 600;        // $6.00 flat shipping per order
const FREE_SHIP_OVER_CENTS = 7500; // free shipping at $75+

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function loadProducts(origin) {
  const r = await fetch(new URL("/products.js", origin), { cache: "no-store" });
  if (!r.ok) throw new Error("Couldn't load products.js (" + r.status + ")");
  const text = await r.text();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  return JSON.parse(text.slice(start, end + 1));
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: "Checkout isn't set up yet. Please check back soon!" }, 500);

  let items;
  try { ({ items } = await req.json()); } catch { return json({ error: "Your bag couldn't be read." }, 400); }
  if (!Array.isArray(items) || items.length === 0) return json({ error: "Your bag is empty." }, 400);
  if (items.length > 50) return json({ error: "That's a lot of pieces! Please check out in two orders." }, 400);

  const origin = new URL(req.url).origin;
  let products;
  try { products = await loadProducts(origin); }
  catch (e) { console.error(e); return json({ error: "Checkout is having trouble. Please try again soon." }, 500); }
  const byId = new Map(products.map(p => [p.id, p]));

  const soldIds = [];
  const lines = [];
  for (const it of items) {
    const p = byId.get(it && it.id);
    if (!p || p.sold) { soldIds.push(it && it.id); continue; }
    const qty = Math.max(1, Math.min(Number(it.qty) || 1, Number(p.qty) || 1));
    lines.push({ p, qty });
  }
  if (soldIds.length) {
    return json({ error: "Sorry! Something in your bag just sold, so I took it out. Take a look and try again.", soldIds }, 409);
  }

  const subtotal = lines.reduce((n, l) => n + Math.round(l.p.price * 100) * l.qty, 0);
  const shipping = subtotal >= FREE_SHIP_OVER_CENTS ? 0 : SHIPPING_CENTS;

  const f = new URLSearchParams();
  f.append("mode", "payment");
  f.append("success_url", origin + "/thanks.html?session_id={CHECKOUT_SESSION_ID}");
  f.append("cancel_url", origin + "/#shop");
  f.append("shipping_address_collection[allowed_countries][0]", "US");
  f.append("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  f.append("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(shipping));
  f.append("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "usd");
  f.append("shipping_options[0][shipping_rate_data][display_name]", shipping ? "Standard shipping" : "Free shipping");
  lines.forEach(({ p, qty }, i) => {
    const b = `line_items[${i}]`;
    f.append(`${b}[quantity]`, String(qty));
    f.append(`${b}[price_data][currency]`, "usd");
    f.append(`${b}[price_data][unit_amount]`, String(Math.round(p.price * 100)));
    f.append(`${b}[price_data][product_data][name]`, p.title.slice(0, 250));
    f.append(`${b}[price_data][product_data][images][0]`, p.image);
    f.append(`${b}[price_data][product_data][metadata][item_id]`, p.id.slice(0, 500));
    if (p.condition) f.append(`${b}[price_data][product_data][description]`, "Condition: " + p.condition);
  });
  // item ids on the order itself, so you can see what to mark sold
  f.append("metadata[items]", lines.map(l => l.p.id).join(", ").slice(0, 500));

  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body: f
  });
  const data = await r.json();
  if (!r.ok) {
    console.error("Stripe error:", data && data.error);
    return json({ error: "Checkout didn't open. Please try again in a moment." }, 502);
  }
  return json({ url: data.url });
};
