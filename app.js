/* CardIQ concept prototype. All data is fictional and computed in the browser. */
(function () {
  "use strict";

  var CATS = {
    food: "Food delivery", shopkart: "ShopKart (online)", online: "Other online shopping",
    grocery: "Groceries", dining: "Dining out", travel: "Travel", bills: "Bills & recharges",
    fuel: "Fuel", other: "Others"
  };

  // Simplified, fictional benefit rules. rate = % value back.
  var CARDS = [
    { id: "A", name: "CashPlus", bank: "Bank A", last4: "4521", kind: "Cashback",
      rates: { food: 5, shopkart: 5, online: 5, fuel: 0 }, base: 1,
      accel: ["food", "shopkart", "online"], cap: 750,
      ruleText: "5% on food delivery and online shopping (₹750/month cap), 1% elsewhere, 0% fuel",
      fee: 1000, waiver: { need: 100000, ytd: 84000, by: "14 Jan 2027", label: "Annual fee waiver" },
      due: "14 Nov" },
    { id: "B", name: "Rewards Gold", bank: "Bank B", last4: "7730", kind: "Points",
      rates: { dining: 3.33, travel: 3.33, bills: 0.67, fuel: 0 }, base: 1.33,
      ruleText: "4 pts per ₹150 (≈1.33%), 10 pts per ₹150 on dining and travel (≈3.33%); pts worth ₹0.50 as vouchers",
      fee: 2500, waiver: { need: 300000, ytd: 162000, by: "2 Mar 2027", label: "Annual fee waiver" },
      milestone: { need: 100000, done: 55000, by: "31 Dec", days: 50, reward: 1000, label: "Quarterly milestone (Oct–Dec)" },
      points: { bal: 4800, expiring: 2400, on: "30 Nov", days: 19, voucher: 0.5, credit: 0.25 },
      due: "18 Nov" },
    { id: "C", name: "ShopMore", bank: "Bank C", last4: "1180", kind: "Co-brand cashback",
      rates: { shopkart: 5, bills: 2, fuel: 0 }, base: 1,
      ruleText: "5% on ShopKart, 2% on bills and recharges, 1% elsewhere, no cap, lifetime free",
      fee: 0, due: "22 Nov" }
  ];

  // Rohan's October statement (default card: CashPlus).
  var OCT = [
    ["02 Oct", "FoodNow", "food", 540, "A"], ["03 Oct", "ShopKart", "shopkart", 4200, "A"],
    ["05 Oct", "BESCOM electricity", "bills", 2650, "A"], ["06 Oct", "FreshBasket", "grocery", 2300, "A"],
    ["08 Oct", "FoodNow", "food", 620, "A"], ["09 Oct", "Mobile postpaid", "bills", 999, "A"],
    ["11 Oct", "Flyaway Airlines", "travel", 8400, "A"], ["12 Oct", "The Brew Room", "dining", 2600, "A"],
    ["13 Oct", "ShopKart", "shopkart", 3800, "A"], ["14 Oct", "QuickMart online", "online", 1900, "A"],
    ["15 Oct", "Fuel station", "fuel", 3000, "B"], ["16 Oct", "FoodNow", "food", 710, "A"],
    ["18 Oct", "StayEasy Hotels", "travel", 6200, "B"], ["19 Oct", "Spice Route", "dining", 3100, "B"],
    ["20 Oct", "FreshBasket", "grocery", 2800, "C"], ["21 Oct", "ShopKart", "shopkart", 2100, "C"],
    ["22 Oct", "FoodNow", "food", 480, "A"], ["24 Oct", "Gas cylinder", "bills", 950, "A"],
    ["25 Oct", "StyleHub online", "online", 2400, "A"], ["26 Oct", "Cinema Plus", "other", 900, "A"],
    ["27 Oct", "FoodNow", "food", 560, "A"], ["28 Oct", "Pharmacy", "other", 1350, "B"],
    ["29 Oct", "Home broadband", "bills", 1180, "A"], ["30 Oct", "CabGo", "other", 640, "A"]
  ].map(function (t) { return { d: t[0], m: t[1], cat: t[2], amt: t[3], card: t[4] }; });

  var PRESETS = [
    { k: "bills", label: "Electricity bill · BESCOM", amt: 2700 },
    { k: "shopkart", label: "ShopKart order", amt: 3500 },
    { k: "food", label: "FoodNow order", amt: 650 },
    { k: "travel", label: "Flight booking", amt: 9000 },
    { k: "dining", label: "Restaurant (credit card on UPI)", amt: 2200 },
    { k: "fuel", label: "Fuel station", amt: 2000 }
  ];

  var S;
  function fresh() {
    return {
      level: 0, screen: "bill", open: null, uploading: false,
      novCapUsed: { A: 520 }, checkout: { p: 0, amt: 2700, card: null },
      waiverYtd: { A: 84000, B: 162000 }, msDone: 55000, nov: [], pickerOpen: false
    };
  }

  // ---------- reward engine ----------
  function byId(id) { return CARDS.filter(function (c) { return c.id === id; })[0]; }
  function rateOf(card, cat) { return card.rates[cat] !== undefined ? card.rates[cat] : card.base; }
  // reward for amt on card given cap already used; returns {r, capUse, note}
  function reward(card, cat, amt, capUsed) {
    var rate = rateOf(card, cat);
    if (card.cap && card.accel.indexOf(cat) >= 0) {
      var left = Math.max(0, card.cap - (capUsed || 0));
      var acc = amt * rate / 100;
      if (acc <= left) return { r: acc, capUse: acc, note: rate + "% × " + inr(amt) };
      var over = (acc - left) / (rate / 100);
      return { r: left + over * card.base / 100, capUse: left,
        note: "5% until cap (" + inr(left) + " left), then " + card.base + "%" };
    }
    return { r: amt * rate / 100, capUse: 0, note: fmtRate(rate) + " × " + inr(amt) };
  }
  function fmtRate(x) { return (Math.round(x * 100) / 100) + "%"; }
  function inr(n) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

  // Actual vs best allocation for the October statement.
  function analyse() {
    var capA = 0, capBest = 0, rows = [];
    OCT.forEach(function (t) {
      var used = byId(t.card);
      var a = reward(used, t.cat, t.amt, t.card === "A" ? capA : 0);
      if (t.card === "A") capA += a.capUse;
      // best: highest reward; tie -> card that does not use a cap
      var best = null;
      CARDS.forEach(function (c) {
        var x = reward(c, t.cat, t.amt, c.id === "A" ? capBest : 0);
        if (!best || x.r > best.x.r + 0.01 || (Math.abs(x.r - best.x.r) <= 0.01 && x.capUse < best.x.capUse)) best = { c: c, x: x };
      });
      if (best.c.id === "A") capBest += best.x.capUse;
      // Same card in both: the gap is only cap timing, so it is not an actionable "use another card" miss.
      var miss = best.c.id === t.card ? 0 : Math.max(0, best.x.r - a.r);
      rows.push({ t: t, earned: a.r, note: a.note, best: best.c, bestR: best.x.r, missed: miss });
    });
    var per = {}, cat = {};
    CARDS.forEach(function (c) { per[c.id] = { spend: 0, earned: 0, missed: 0, rows: [] }; });
    rows.forEach(function (r) {
      var p = per[r.t.card]; p.spend += r.t.amt; p.earned += r.earned; p.missed += r.missed; p.rows.push(r);
      if (r.missed > 0.5) {
        var key = r.t.cat + ">" + r.best.id;
        cat[key] = cat[key] || { cat: r.t.cat, card: r.best, amt: 0, missed: 0, from: {} };
        cat[key].amt += r.t.amt; cat[key].missed += r.missed; cat[key].from[r.t.card] = 1;
      }
    });
    var fixes = Object.keys(cat).map(function (k) { return cat[k]; }).sort(function (a, b) { return b.missed - a.missed; });
    var tot = { earned: 0, missed: 0, spend: 0 };
    CARDS.forEach(function (c) { tot.earned += per[c.id].earned; tot.missed += per[c.id].missed; tot.spend += per[c.id].spend; });
    return { per: per, fixes: fixes, tot: tot };
  }
  var AN = analyse();

  // ---------- rendering ----------
  var $ = function (id) { return document.getElementById(id); };
  var TITLES = { bill: "Credit card bill", report: "October card report", goals: "Milestones and expiry",
    checkout: "Pay ₹ · choose method", data: "My data and consent", cards: "Confirm your cards", upload: "Upload statement" };

  function render() {
    var s = S.screen, h = "";
    if (s === "bill") h = vBill(); else if (s === "report") h = vReport(); else if (s === "goals") h = vGoals();
    else if (s === "checkout") h = vCheckout(); else if (s === "data") h = vData();
    else if (s === "cards") h = vCards(); else if (s === "upload") h = vUpload();
    $("screen").innerHTML = h;
    $("screen").scrollTop = 0;
    $("title").textContent = s === "checkout" ? "Pay " + inr(S.checkout.amt) + " · " + PRESETS[S.checkout.p].label.split(" · ")[0] : TITLES[s];
    $("back").hidden = !(s === "cards" || s === "upload");
    $("lvlBadge").textContent = "Level " + S.level;
    document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.s === s); });
    document.querySelectorAll("#levels button").forEach(function (b) { b.classList.toggle("on", +b.dataset.l === S.level); });
    document.querySelectorAll("#steps li").forEach(function (li) { li.classList.toggle("on", li.dataset.go === s); });
    $("lvlText").innerHTML = [
      "<b>Level 0:</b> Paytm only has what BBPS returns when a bill is paid: issuer, last 4 digits, statement total, due date. No new permission.",
      "<b>Level 1:</b> Rohan tapped his exact card variants once. Benefit rules, caps and milestones now apply.",
      "<b>Level 2:</b> Rohan uploaded his October statements. They were parsed on the phone, and only category totals were kept."
    ][S.level];
    var q = "?screen=" + s + "&level=" + S.level;
    try { history.replaceState(null, "", q); } catch (e) { /* file:// */ }
  }

  function cardLine(c) { return "<b>" + c.name + "</b> <span class=\"muted\">· " + c.bank + " ••" + c.last4 + "</span>"; }
  function cardLine0(c) { return "<b>" + c.bank + " credit card</b> <span class=\"muted\">••" + c.last4 + "</span>"; }

  function vBill() {
    var A = byId("A"), paid = AN.per.A.spend;
    var h = "<div class=\"c\" style=\"text-align:center\"><div class=\"check\">✓</div><div class=\"big\">" + inr(paid) + " paid</div>" +
      "<div class=\"muted small\">" + (S.level ? A.name + " · " : "") + A.bank + " ••" + A.last4 + " · due " + A.due + " · paid 3 days early</div>" +
      "<div class=\"xs muted\" style=\"margin-top:4px\">Paid via BBPS · reference BBPS2611-73019</div></div>";
    if (S.level === 0) {
      h += "<div class=\"c hl\"><h4>Is your card earning what it should?</h4><p class=\"small\">We found <b>3 credit cards</b> in your bill payments. Tell us which variant each one is (one tap each) and we will track fee waivers, milestones and the best card for every payment.</p>" +
        "<button class=\"btn\" style=\"margin-top:8px\" data-act=\"goCards\">Confirm my 3 cards</button><p class=\"xs muted\" style=\"margin-top:6px\">No new permission needed. Takes about 20 seconds.</p></div>";
    } else if (S.level === 1) {
      h += "<div class=\"c hl\"><h4>Your cards are set up</h4><p class=\"small\">CashPlus is <b>" + inr(100000 - S.waiverYtd.A) + "</b> away from waiving its " + inr(1000) + " fee. Rewards Gold has <b>2,400 points</b> to check before 30 Nov.</p>" +
        "<button class=\"btn\" style=\"margin-top:8px\" data-go=\"goals\">See milestones</button>" +
        "<button class=\"btn o\" style=\"margin-top:6px\" data-act=\"goUpload\">See what you earned vs missed in October</button></div>";
    } else {
      h += "<div class=\"c hl\"><h4>Your October card report is ready</h4><div class=\"row\" style=\"margin-top:4px\"><span>Earned across 3 cards</span><span class=\"g\">" + inr(AN.tot.earned) + "</span></div>" +
        "<div class=\"row\"><span>Missed</span><span class=\"r\">" + inr(AN.tot.missed) + "</span></div>" +
        "<button class=\"btn\" style=\"margin-top:8px\" data-go=\"report\">See how to get it back</button></div>";
    }
    h += "<div class=\"c small muted\">+ 25 gold coins for paying on Paytm</div>";
    h += "<div class=\"c\"><h4>Upcoming bills</h4>" + CARDS.slice(1).map(function (c) {
      return "<div class=\"tx\"><span>" + (S.level ? cardLine(c) : cardLine0(c)) + "</span><span>due " + c.due + "</span></div>";
    }).join("") + "</div>";
    return h;
  }

  function vCards() {
    var opts = {
      A: ["Bank A Basic", "Bank A CashPlus", "Bank A Signature"],
      B: ["Bank B Classic", "Bank B Rewards Gold", "Bank B Infinite"],
      C: ["Bank C ShopMore", "Bank C Platinum"]
    };
    var right = { A: "Bank A CashPlus", B: "Bank B Rewards Gold", C: "Bank C ShopMore" };
    var h = "<div class=\"c small\">We know these cards from the bills you paid on Paytm. Pick the exact variant so we can apply the right rules. Card variants only: <b>we never store card numbers</b>.</div>";
    CARDS.forEach(function (c) {
      h += "<div class=\"c\"><div>" + cardLine0(c) + "</div><div class=\"xs muted\" style=\"margin:2px 0 6px\">Seen in 4 bill payments · last statement " + inr(AN.per[c.id].spend) + "</div><select aria-label=\"Variant\">" +
        opts[c.id].map(function (o) { return "<option" + (o === right[c.id] ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></div>";
    });
    h += "<button class=\"btn\" data-act=\"confirmCards\">Confirm cards</button><p class=\"xs muted\" style=\"text-align:center\">The right variants are preselected for this demo.</p>";
    return h;
  }

  function vUpload() {
    if (S.uploading) return "<div class=\"c\" style=\"text-align:center\"><div class=\"spin\"></div><b>Reading your statements on this phone…</b><p class=\"small muted\" style=\"margin-top:6px\">24 transactions found · 9 categories · 3 cards</p><p class=\"xs muted\" style=\"margin-top:6px\">The PDFs never leave your phone. Only category totals are kept.</p></div>";
    return "<div class=\"c small\"><h4>Add your October statements</h4>Choose the PDFs your banks emailed you. If a PDF has a password, you type it here: it is used on this phone only and never stored.</div>" +
      CARDS.map(function (c) { return "<div class=\"c row small\"><span>📄 " + c.bank + "_Statement_Oct2026.pdf</span><span class=\"pill best\">ready</span></div>"; }).join("") +
      "<div class=\"c xs muted\">What we keep: category totals per card (for example \"Travel ₹14,600\"). What we delete: the PDF, merchant names after the report is built, and the password.</div>" +
      "<button class=\"btn\" data-act=\"doUpload\">Read statements on this phone</button>";
  }

  function vReport() {
    if (S.level === 0) {
      return "<div class=\"c\"><h4>October, from your bill payments</h4>" + CARDS.map(function (c) {
        return "<div class=\"tx\"><span>" + cardLine0(c) + "</span><span>" + inr(AN.per[c.id].spend) + "</span></div>";
      }).join("") + "<div class=\"xs muted\" style=\"margin-top:6px\">Statement totals from BBPS bill fetch.</div></div>" +
        "<div class=\"c lock\"><p class=\"small\">🔒 To see what each card earned and missed, first tell us which variant each card is.</p><button class=\"btn\" style=\"margin-top:8px\" data-act=\"goCards\">Confirm my cards</button></div>";
    }
    if (S.level === 1) {
      return "<div class=\"c\"><h4>October spend by card</h4>" + CARDS.map(function (c) {
        return "<div class=\"tx\"><span>" + cardLine(c) + "</span><span>" + inr(AN.per[c.id].spend) + "</span></div>";
      }).join("") + "<div class=\"xs muted\" style=\"margin-top:6px\">We know the rules for each card now, but not what you spent where.</div></div>" +
        "<div class=\"c lock\"><p class=\"small\">🔒 Upload October statements to see <b>earned vs missed</b>, by card and by category.</p><button class=\"btn\" style=\"margin-top:8px\" data-act=\"goUpload\">Upload statements</button><p class=\"xs muted\" style=\"margin-top:6px\">Read on your phone. Only category totals kept.</p></div>";
    }
    var f = AN.fixes[0];
    var h = "<div class=\"c\"><div class=\"row\"><span class=\"small muted\">October · 3 cards · " + inr(AN.tot.spend) + " spent</span></div>" +
      "<div class=\"row\" style=\"margin-top:6px\"><div><div class=\"xs muted\">Earned</div><div class=\"big g\">" + inr(AN.tot.earned) + "</div></div>" +
      "<div style=\"text-align:right\"><div class=\"xs muted\">Missed</div><div class=\"big r\">" + inr(AN.tot.missed) + "</div></div></div>" +
      "<div class=\"xs muted\">Missed = what the best of your 3 cards would have earned on the same spends, minus what you earned.</div></div>";
    h += "<div class=\"c fix\"><h4>Biggest fix: " + CATS[f.cat].toLowerCase() + " on " + f.card.name + "</h4>" +
      "<p class=\"small\">You put " + inr(f.amt) + " of " + CATS[f.cat].toLowerCase() + " on " + Object.keys(f.from).map(function (id) { return byId(id).name; }).join(" and ") +
      ". On " + f.card.name + " it earns " + fmtRate(rateOf(f.card, f.cat)) + ". <span class=\"g\">+" + inr(f.missed) + " a month</span> at October spend.</p>" +
      "<div class=\"formula\">" + fmtRate(rateOf(f.card, f.cat)) + " × " + inr(f.amt) + " − earned = " + inr(f.missed) + " · rule verified 2 Nov 2026</div></div>";
    if (AN.fixes.length > 1) {
      h += "<div class=\"c\"><h4>Other fixes</h4>" + AN.fixes.slice(1, 4).map(function (x) {
        return "<div class=\"tx\"><span>" + CATS[x.cat] + " → " + x.card.name + " (" + fmtRate(rateOf(x.card, x.cat)) + ")</span><span class=\"g\">+" + inr(x.missed) + "</span></div>";
      }).join("") + "</div>";
    }
    CARDS.forEach(function (c) {
      var p = AN.per[c.id], open = S.open === c.id;
      h += "<div class=\"c\" data-act=\"toggle\" data-id=\"" + c.id + "\" style=\"cursor:pointer\"><div class=\"row\"><span>" + cardLine(c) + "</span><span class=\"muted\">" + (open ? "▴" : "▾") + "</span></div>" +
        "<div class=\"small\">Spent " + inr(p.spend) + " · earned <span class=\"g\">" + inr(p.earned) + "</span> · missed <span class=\"r\">" + inr(p.missed) + "</span></div>";
      if (open) {
        h += "<div class=\"xs muted\" style=\"margin:6px 0\">" + c.ruleText + "</div>" + p.rows.map(function (r) {
          return "<div class=\"tx\"><span>" + r.t.d + " · " + r.t.m + "<br><span class=\"formula\">" + r.note + "</span></span><span style=\"text-align:right\">" + inr(r.t.amt) +
            "<br><span class=\"g xs\">+" + inr(r.earned) + "</span>" + (r.missed > 0.5 ? " <span class=\"r xs\">−" + inr(r.missed) + " vs " + r.best.name + "</span>" : "") + "</span></div>";
        }).join("");
      }
      h += "</div>";
    });
    h += "<div class=\"c xs muted\">Amounts are rounded. Card rules and spends are fictional for this demo. Nothing on this screen is sponsored.</div>";
    return h;
  }

  function bar(done, need) {
    var pct = Math.min(100, done / need * 100);
    return "<div class=\"pb" + (pct >= 100 ? " done" : "") + "\"><i style=\"width:" + pct + "%\"></i></div>";
  }

  function vGoals() {
    if (S.level === 0) {
      return "<div class=\"c\"><h4>What we can see today</h4>" + CARDS.map(function (c) {
        return "<div class=\"tx\"><span>" + cardLine0(c) + "</span><span>due " + c.due + "</span></div>";
      }).join("") + "</div><div class=\"c lock\"><p class=\"small\">🔒 Fee waivers and milestones depend on your exact card variant.</p><button class=\"btn\" style=\"margin-top:8px\" data-act=\"goCards\">Confirm my cards</button></div>";
    }
    var A = byId("A"), B = byId("B"), ms = B.milestone, pts = B.points;
    var gapA = A.waiver.need - S.waiverYtd.A, gapM = ms.need - S.msDone;
    var h = "<div class=\"c\"><h4>" + A.name + " · " + A.waiver.label + "</h4>" + bar(S.waiverYtd.A, A.waiver.need) +
      "<div class=\"small\">" + inr(S.waiverYtd.A) + " of " + inr(A.waiver.need) + (gapA > 0 ? " · <b>" + inr(gapA) + " more by " + A.waiver.by + "</b> saves " + inr(A.fee) : " · <span class=\"g\">done: fee waived</span>") + "</div>" +
      "<div class=\"xs muted\">≈ " + inr(Math.max(0, gapA) / 9) + " a week for the next 9 weeks. Your usual spend on this card covers it.</div></div>";
    h += "<div class=\"c\"><h4>" + B.name + " · " + ms.label + "</h4>" + bar(S.msDone, ms.need) +
      "<div class=\"small\">" + inr(S.msDone) + " of " + inr(ms.need) + (gapM > 0 ? " · " + ms.days + " days left · voucher worth " + inr(ms.reward) : " · <span class=\"g\">unlocked: " + inr(ms.reward) + " voucher</span>") + "</div>" +
      (gapM > 0 ? "<div class=\"xs muted\">You need " + inr(gapM) + " more. At your October pace on this card you will miss it. Moving travel and dining here closes most of the gap.</div>" : "") + "</div>";
    h += "<div class=\"c\"><h4>" + B.name + " · " + B.waiver.label + "</h4>" + bar(S.waiverYtd.B, B.waiver.need) +
      "<div class=\"small\">" + inr(S.waiverYtd.B) + " of " + inr(B.waiver.need) + " by " + B.waiver.by + " · saves " + inr(B.fee) + "</div></div>";
    if (S.level === 2) {
      h += "<div class=\"c\" style=\"border:1.5px solid var(--amber)\"><h4 class=\"r\">" + pts.expiring.toLocaleString("en-IN") + " points expire " + pts.on + " (" + pts.days + " days)</h4>" +
        "<div class=\"small\">As vouchers: <b>" + inr(pts.expiring * pts.voucher) + "</b> · as statement credit: " + inr(pts.expiring * pts.credit) + "</div>" +
        "<div class=\"formula\">2,400 × ₹0.50 = ₹1,200 vs 2,400 × ₹0.25 = ₹600</div>" +
        "<button class=\"btn o\" style=\"margin-top:8px\" data-act=\"redeem\">Redeem as vouchers in the Bank B app ↗</button></div>";
    } else {
      h += "<div class=\"c lock small\">🔒 Points balance and expiry come from your statement. <button class=\"btn o\" style=\"margin-top:6px\" data-act=\"goUpload\">Upload statements</button></div>";
    }
    h += "<div class=\"c xs muted\">Reminders 30, 7 and 1 day before each deadline. At most 2 pushes per bill cycle.</div>";
    return h;
  }

  function options() {
    var p = PRESETS[S.checkout.p], amt = S.checkout.amt, B = byId("B");
    var list = CARDS.map(function (c) {
      var x = reward(c, p.k, amt, c.id === "A" ? S.novCapUsed.A : 0);
      var o = { c: c, r: x.r, note: x.note, extra: 0, tags: [] };
      if (c.cap && c.accel.indexOf(p.k) >= 0) {
        var left = c.cap - S.novCapUsed.A;
        o.tags.push(left <= 0 ? "5% cap used up this month" : inr(left) + " of " + inr(c.cap) + " cap left this month");
      }
      if (c.id === "B" && S.msDone < B.milestone.need) {
        var gap = B.milestone.need - S.msDone;
        if (amt >= gap) { o.extra = B.milestone.reward; o.tags.push("completes the " + inr(B.milestone.reward) + " milestone voucher"); }
        else o.tags.push("moves milestone to " + inr(S.msDone + amt) + " of " + inr(B.milestone.need));
      }
      return o;
    });
    list.push({ c: null, r: 0, note: "UPI from bank account", extra: 0, tags: [] });
    list.sort(function (a, b) { return (b.r + b.extra) - (a.r + a.extra); });
    return list;
  }

  function vCheckout() {
    var p = PRESETS[S.checkout.p], amt = S.checkout.amt;
    var h = "<div class=\"c\"><label class=\"xs muted\">Demo: what is Rohan paying for?</label><select id=\"preset\">" +
      PRESETS.map(function (x, i) { return "<option value=\"" + i + "\"" + (i === S.checkout.p ? " selected" : "") + ">" + x.label + " (" + CATS[x.k] + ")</option>"; }).join("") + "</select>" +
      "<label class=\"xs muted\" style=\"display:block;margin-top:8px\">Amount: <b>" + inr(amt) + "</b></label><input id=\"amt\" type=\"range\" min=\"100\" max=\"50000\" step=\"100\" value=\"" + amt + "\"></div>";
    if (S.level === 0) {
      return h + CARDS.map(function (c) { return "<div class=\"opt\"><div class=\"grow\">" + cardLine0(c) + "</div></div>"; }).join("") +
        "<div class=\"c lock small\">🔒 Confirm your card variants and we will show which card earns the most here.<button class=\"btn\" style=\"margin-top:8px\" data-act=\"goCards\">Confirm my cards</button></div>";
    }
    var list = options(), best = list[0], base = list.filter(function (o) { return o.c && o.c.id === "A"; })[0];
    if (!S.checkout.card || !list.some(function (o) { return (o.c ? o.c.id : "UPI") === S.checkout.card; })) S.checkout.card = best.c ? best.c.id : "UPI";
    h += "<div class=\"xs muted\">Choose payment method · ranked by what you get back</div>";
    list.forEach(function (o, i) {
      var id = o.c ? o.c.id : "UPI", sel = S.checkout.card === id;
      var val = o.r + o.extra;
      h += "<label class=\"opt" + (sel ? " sel" : "") + "\"><input type=\"radio\" name=\"pm\" value=\"" + id + "\"" + (sel ? " checked" : "") + "><div class=\"grow\">" +
        (o.c ? cardLine(o.c) : "<b>UPI · bank account</b>") + (i === 0 && val > 0 ? " <span class=\"pill best\">Best" + (o.extra ? " incl. milestone" : "") + "</span>" : "") +
        "<div class=\"xs muted\">" + (o.c ? o.note : "no rewards") + (o.tags.length ? " · " + o.tags.join(" · ") : "") + "</div></div>" +
        "<div class=\"g\">+" + inr(val) + "</div></label>";
    });
    if (best.c && base && best.c.id !== "A") {
      h += "<div class=\"c fix small\">vs your default card (CashPlus): <b class=\"g\">+" + inr(best.r + best.extra - base.r) + "</b> on this payment.</div>";
    }
    h += "<button class=\"btn navy\" data-act=\"pay\">Pay " + inr(amt) + "</button><p class=\"xs muted\" style=\"text-align:center\">Ranking uses only your cards' rules. No issuer pays to be shown first.</p>";
    if (S.nov.length) h += "<div class=\"c\"><h4>Paid in this demo</h4>" + S.nov.map(function (t) { return "<div class=\"tx\"><span>" + t.label + " · " + t.card + "</span><span>" + inr(t.amt) + " <span class=\"g xs\">+" + inr(t.r) + "</span></span></div>"; }).join("") + "</div>";
    return h;
  }

  function vData() {
    var rows = [
      ["Bill payment data (via BBPS)", "Issuer, last 4 digits, statement total, due date", "Needed to pay your bills", null],
      ["Card variants", S.level >= 1 ? "CashPlus, Rewards Gold, ShopMore (you picked)" : "Not shared", "Rules, caps, milestones", S.level >= 1 ? "delCards" : null],
      ["Statement category totals", S.level >= 2 ? "October 2026 · 9 categories × 3 cards" : "Not shared", "Earned vs missed, points expiry", S.level >= 2 ? "delStmt" : null],
      ["Email statements (auto)", "Off · not in V1", "Monthly reports without uploading", null]
    ];
    return "<div class=\"c small\">Everything CardIQ knows about you, and why. Delete anything, any time.</div>" + rows.map(function (r) {
      return "<div class=\"c\"><div class=\"row\"><h4>" + r[0] + "</h4>" + (r[3] ? "<button class=\"pill warn\" style=\"border:none\" data-act=\"" + r[3] + "\">Delete</button>" : "") + "</div><div class=\"small\">" + r[1] + "</div><div class=\"xs muted\">Used for: " + r[2] + "</div></div>";
    }).join("") +
      "<div class=\"c xs muted\"><b>Never stored:</b> full card numbers (tokenisation rules), statement PDFs, PDF passwords, SMS. <b>Never used for:</b> ads, or sharing with issuers. <b>Sponsored placements:</b> none.</div>";
  }

  // ---------- events ----------
  function toast(msg) { var t = $("toast"); t.innerHTML = msg; t.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove("show"); }, 2800); }
  function go(s) { S.screen = s; render(); }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-go],[data-act],[data-s],[data-l]");
    if (!el) return;
    if (el.dataset.s) return go(el.dataset.s);
    if (el.dataset.l !== undefined && el.closest("#levels")) { S.level = +el.dataset.l; return render(); }
    if (el.dataset.go && !el.dataset.act) return go(el.dataset.go);
    var a = el.dataset.act;
    if (a === "goCards") go("cards");
    else if (a === "goUpload") { if (S.level < 1) { S.level = 1; } go("upload"); }
    else if (a === "confirmCards") { S.level = Math.max(S.level, 1); toast("3 cards confirmed. Rules and milestones are on."); go("goals"); }
    else if (a === "doUpload") { S.uploading = true; render(); setTimeout(function () { S.uploading = false; S.level = 2; toast("Statements read on your phone. PDFs deleted."); go("report"); }, 1600); }
    else if (a === "toggle") { S.open = S.open === el.dataset.id ? null : el.dataset.id; var y = $("screen").scrollTop; render(); $("screen").scrollTop = y; }
    else if (a === "redeem") toast("Opens the Bank B app to redeem. CardIQ never moves your points.");
    else if (a === "delCards") { S.level = 0; toast("Card variants deleted. Back to Level 0."); render(); }
    else if (a === "delStmt") { S.level = 1; toast("Statement data deleted. Back to Level 1."); render(); }
    else if (a === "pay") pay();
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "preset") { S.checkout.p = +e.target.value; S.checkout.amt = PRESETS[S.checkout.p].amt; S.checkout.card = null; render(); }
    else if (e.target.name === "pm") { S.checkout.card = e.target.value; var y = $("screen").scrollTop; render(); $("screen").scrollTop = y; }
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "amt") { S.checkout.amt = +e.target.value; S.checkout.card = null; var y = $("screen").scrollTop; render(); $("screen").scrollTop = y; var r = $("amt"); if (r) r.focus(); }
  });
  $("back").addEventListener("click", function () { go("bill"); });
  $("reset").addEventListener("click", function () { S = fresh(); render(); toast("Demo reset."); });
  document.querySelectorAll("#steps li").forEach(function (li) { li.addEventListener("click", function () { go(li.dataset.go); }); });

  function pay() {
    var p = PRESETS[S.checkout.p], amt = S.checkout.amt, id = S.checkout.card;
    var o = options().filter(function (x) { return (x.c ? x.c.id : "UPI") === id; })[0];
    var msg = "Paid " + inr(amt) + (o.c ? " with " + o.c.name + ". +" + inr(o.r) + " back." : " by UPI.");
    if (o.c && o.c.id === "A") {
      S.novCapUsed.A += reward(o.c, p.k, amt, S.novCapUsed.A).capUse; S.waiverYtd.A += amt;
      if (S.waiverYtd.A >= 100000 && S.waiverYtd.A - amt < 100000) msg += " Fee waiver unlocked!";
    }
    if (o.c && o.c.id === "B") {
      var before = S.msDone; S.msDone += amt; S.waiverYtd.B += amt;
      if (before < 100000 && S.msDone >= 100000) msg += " Milestone reached: ₹1,000 voucher!";
    }
    S.nov.unshift({ label: p.label.split(" · ")[0], card: o.c ? o.c.name : "UPI", amt: amt, r: o.r + (o.extra || 0) });
    toast(msg); render();
  }

  // ---------- boot ----------
  S = fresh();
  var q = new URLSearchParams(location.search);
  if (q.get("level") !== null && /^[012]$/.test(q.get("level"))) S.level = +q.get("level");
  if (q.get("screen") && TITLES[q.get("screen")]) S.screen = q.get("screen");
  render();
  window.__cardiq = { analyse: analyse, AN: AN };
})();
