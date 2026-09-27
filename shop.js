(function(){
  // Keep these two numbers in sync with netlify/functions/checkout.mjs
  const SHIPPING = 6;          // flat shipping per order, in dollars
  const FREE_SHIP_OVER = 75;   // free shipping when the bag is at least this much

  const ALL = window.PRODUCTS || [];
  const BY_ID = Object.fromEntries(ALL.map(p => [p.id, p]));
  const SECTIONS = ["New in","Tops","Dresses","Skirts","Sweaters & Hoodies","Jackets & Coats","Jeans & Pants","Bags","Accessories","Shoes","Under $25"];
  const TAPES = ["var(--mustard)","var(--neon)","var(--caramel)","var(--wine)"];
  const PAGE = 24;
  let section = "New in", shown = PAGE, list = [], current = null;

  const $ = id => document.getElementById(id);
  const money = n => "$" + (Number.isInteger(n) ? n : n.toFixed(2));
  const thumb = u => u.replace(/\?.*$/, "?width=700&height=700&fit=bounds&bg-color=fff&canvas=700,700");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const plain = h => { const d = document.createElement("div"); d.innerHTML = h; return d.textContent.trim(); };

  /* ---------- bag (saved in this browser) ---------- */
  let bag = [];
  try { bag = JSON.parse(localStorage.getItem("sasa-bag") || "[]"); } catch (e) { bag = []; }
  bag = bag.filter(b => BY_ID[b.id] && !BY_ID[b.id].sold);
  const saveBag = () => { try { localStorage.setItem("sasa-bag", JSON.stringify(bag)); } catch (e) {} drawBag(); };
  const inBag = id => bag.some(b => b.id === id);

  function drawBag(){
    const count = bag.reduce((n,b) => n + b.qty, 0);
    $("bagCount").textContent = count;
    const sub = bag.reduce((n,b) => n + BY_ID[b.id].price * b.qty, 0);
    $("bagList").innerHTML = bag.map(b => { const p = BY_ID[b.id]; return `
      <li><img src="${thumb(p.image)}" alt="">
        <div><div class="t">${esc(p.title)}${b.qty>1 ? " × "+b.qty : ""}</div><button class="rm" type="button" data-rm="${p.id}">Remove</button></div>
        <span class="p">${money(p.price*b.qty)}</span></li>`; }).join("");
    $("bagEmpty").hidden = bag.length > 0;
    $("bagFoot").hidden = bag.length === 0;
    $("bagSub").textContent = money(sub);
    $("shipNote").textContent = sub >= FREE_SHIP_OVER ? "Free shipping!" :
      `Shipping is ${money(SHIPPING)}. Spend ${money(Math.ceil((FREE_SHIP_OVER - sub)*100)/100)} more for free shipping.`;
    $("bagErr").textContent = "";
  }
  $("bagList").addEventListener("click", e => { const id = e.target.dataset.rm; if (id) { bag = bag.filter(b => b.id !== id); saveBag(); } });
  $("bagBtn").addEventListener("click", () => { drawBag(); $("bag").showModal(); });
  $("bagClose").addEventListener("click", () => $("bag").close());
  $("bag").addEventListener("click", e => { if (e.target === $("bag")) $("bag").close(); });

  $("checkoutBtn").addEventListener("click", async () => {
    const btn = $("checkoutBtn");
    btn.disabled = true; btn.textContent = "Heading to checkout…"; $("bagErr").textContent = "";
    try {
      const r = await fetch("/.netlify/functions/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: bag })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.url) { window.location.href = data.url; return; }
      if (data.soldIds && data.soldIds.length) {
        bag = bag.filter(b => !data.soldIds.includes(b.id)); saveBag();
      }
      $("bagErr").textContent = data.error || "Checkout didn't open. Please try again in a moment.";
    } catch (e) {
      $("bagErr").textContent = "Couldn't reach checkout. Check your connection and try again.";
    }
    btn.disabled = false; btn.textContent = "Checkout";
  });

  /* ---------- browsing ---------- */
  const has = s => s === "New in" || (s === "Under $25" ? ALL.some(p => p.under25) : ALL.some(p => p.section === s));
  $("chips").innerHTML = SECTIONS.filter(has).map(s => `<button class="chip" type="button" aria-pressed="${s===section}">${esc(s)}</button>`).join("");
  $("chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) setSection(b.textContent); });
  document.querySelectorAll("[data-go]").forEach(a => a.addEventListener("click", () => setSection(a.dataset.go)));
  function setSection(s){ section = s; shown = PAGE; document.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c.textContent === s)); render(); }

  $("q").addEventListener("input", () => { shown = PAGE; render(); });
  $("sort").addEventListener("change", () => { shown = PAGE; render(); });
  $("moreBtn").addEventListener("click", () => { shown += PAGE; render(); });

  function render(){
    const q = $("q").value.trim().toLowerCase();
    list = ALL.filter(p => section === "New in" ? true : section === "Under $25" ? p.under25 : p.section === section)
              .filter(p => !q || (p.title+" "+p.brand+" "+p.section+" "+plain(p.desc)).toLowerCase().includes(q));
    const s = $("sort").value;
    list.sort((a,b) => (a.sold - b.sold) || (s === "low" ? a.price - b.price : s === "high" ? b.price - a.price : a.order - b.order));
    const avail = list.filter(p => !p.sold).length;
    $("count").textContent = avail + (avail === 1 ? " piece" : " pieces");
    $("empty").hidden = list.length > 0;
    $("grid").innerHTML = list.slice(0, shown).map((p,i) => `
      <button class="item${p.sold ? " sold" : ""}" type="button" data-id="${p.id}" style="--tape:${TAPES[i%4]}">
        <div class="pic"><img src="${thumb(p.image)}" alt="${esc(p.title)}" loading="lazy" width="700" height="700"></div>
        ${p.sold ? '<span class="badge">sold!</span>' : p.qty === 1 ? '<span class="badge">1 of 1</span>' : ''}
        <h3>${esc(p.title)}</h3>
        <div class="meta"><span class="cond">${esc(p.condition)}</span><span class="price">${money(p.price)}</span></div>
      </button>`).join("");
    $("moreBtn").hidden = shown >= list.length;
  }
  $("grid").addEventListener("click", e => { const b = e.target.closest(".item"); if (b) open(b.dataset.id); });

  function setAddButton(){
    const p = current, add = $("dAdd");
    const got = bag.find(b => b.id === p.id);
    const full = got && got.qty >= p.qty;
    add.disabled = p.sold || full;
    add.textContent = p.sold ? "Sold, sorry!" : full ? "In your bag ♡" : "Add to bag";
    $("dHint").textContent = p.sold ? "" : p.qty === 1 ? "Only one available." : "";
  }
  function open(id){
    const p = BY_ID[id]; if (!p) return; current = p;
    $("dImg").src = p.image; $("dImg").alt = p.title;
    $("dBrand").textContent = p.brand; $("dTitle").textContent = p.title;
    $("dPrice").textContent = money(p.price); $("dCond").textContent = "Condition: " + p.condition;
    $("dDesc").innerHTML = p.desc;
    setAddButton();
    $("dlg").showModal();
  }
  $("dAdd").addEventListener("click", () => {
    const p = current; if (!p || p.sold) return;
    const got = bag.find(b => b.id === p.id);
    if (got) { if (got.qty < p.qty) got.qty++; } else bag.push({ id: p.id, qty: 1 });
    saveBag(); setAddButton();
    $("dlg").close(); drawBag(); $("bag").showModal();
  });
  $("dClose").addEventListener("click", () => $("dlg").close());
  $("dlg").addEventListener("click", e => { if (e.target === $("dlg")) $("dlg").close(); });

  drawBag();
  render();
})();
