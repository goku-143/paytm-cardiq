# CardIQ: concept prototype

**Live demo:** https://goku-143.github.io/paytm-cardiq/

**Case deck (PDF):** https://goku-143.github.io/paytm-cardiq/deck.pdf

CardIQ is a product concept for a Paytm product case (Case 3: credit card spends analyzer). It is a monthly card coach that lives inside the credit card bill-pay flow and shows a multi-card user, in rupees:

- what each card **earned** last month,
- what it **missed** (wrong card used, caps exhausted),
- fee waivers, milestones and **points about to expire**,
- the **best card for the next payment**, at checkout.

## The idea it tests: a consent ladder

| Level | What the user shares | What unlocks |
|---|---|---|
| 0 | Nothing new: the bill data the bill-payment system (BBPS) returns | Statement totals, due dates |
| 1 | Card variants, picked once | Fee-waiver and milestone progress, best card at checkout |
| 2 | Statement PDFs, read on the phone (only category totals are kept) | Earned vs missed, points expiry |

Use the Level switch on the right of the demo to see how each screen changes.

## Deep links

- `?screen=report&level=2`: the earned-vs-missed report
- `?screen=goals&level=1`: milestones and fee waivers
- `?screen=checkout&level=1`: best card at checkout (change the category and amount, then pay)
- `?screen=data&level=2`: what is stored, and delete controls

## Notes

- All banks, cards, benefit rules and spends are **fictional and simplified**. They are computed live in the browser (`app.js`), with no backend and no tracking.
- This is a concept for a case study, not affiliated with Paytm or any card issuer.
- Built with plain HTML, CSS and JavaScript.

Shubham Meena · IIM Lucknow
