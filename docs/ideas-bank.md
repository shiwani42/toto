Idea 1:

The PS is pointing at a single shopper standing in front of an overwhelming wall of choice. The strategic question isn't "how do we give them more information" — it's "how do we collapse 4,000 SKUs into the 3 right ones for this person, in under a minute, with confidence."

The interesting reframe: every existing "in-store shopping app" assumes the customer has already picked up a product to scan. But the harder moment is before they pick anything up — when they face the shelf. That moment is currently solved by a sales associate, or by walkout.

Strongest idea: Shelf Lens

Point your phone at any shelf, aisle, or rack. The app uses Scandit's MatrixScan + AR overlay to read every product on the shelf simultaneously. Within ~1 second, the AR view dims everything except the 2–3 products that match your needs — each glowing with a confidence score and a one-line "why."

The shopper's flow:
1. 30-second onboard at store entry (QR code → web app, no install). Three questions: who is this for? / what's the use case? / what matters most (price, weight, sustainability, durability)?
2. Walk to any wall. Point phone. The AR view highlights the 3 best matches across all brands — not the ones with the highest commission.
3. Tap to see why. "PFC-free Gore-Tex Pro, mid-weight matches your Tour du Mont Blanc demands, your preferred fit cut."
4. Tap two products to compare. Side-by-side breakdown, with the spec differences explained against your use case (not generic "lighter is better").
5. Confidence close. When dwell time signals near-decision, the app proactively neutralizes the common walkout reasons: "your size is in stock at the back," "this brand has a 60-day return," "reviews from 8 hikers with similar profiles average 4.7 for Alps use."

Why this is a uniquely good fit for Scandit

This is the cleanest composition with Scandit's actual differentiator I've seen:
- MatrixScan, their proprietary multi-object scanning, is currently sold to employees for inventory counting. Pointing it at the consumer side of the same problem — "decode the whole shelf, but for shopping not stock-taking" — is a clean inversion that nobody is doing.
- AR overlays on a physical shelf, dimming irrelevant products and highlighting matches, is visually dramatic and is Scandit's most differentiated UX primitive.
- No download required. Scandit runs in mobile browsers via WebAssembly — you can launch the experience from a QR code at the store entrance, removing the #1 friction of in-store apps (install + signup).

Most "AI shopping assistant" startups are chatbots or recommendation engines. Almost none of them work in physical multi-brand retail because they lack the computer-vision-on-shelf primitive. Scandit has it, has shipped it at scale, and isn't currently using it for this purpose.


Idea 2: 
Price Decoder. Scan two similar products with a €200 gap. App explains where the money actually goes: "+€80 Gore-Tex Pro vs proprietary, +€60 full-grain leather, +€60 brand premium." Wedge: customers anchor on sticker shock and walk; nobody tells them what they're actually paying for.

Idea 3:

Twin Shopper. You're in the store, your partner is at home. Scan a tent — partner gets live AR view through your phone, can vote, can suggest alternatives, can read specs while you handle the product. Real-time co-shopping anchored on the physical object. Wedge: a huge fraction of significant-purchase decisions involve someone not in the store. Solved technologically but never productized for retail.

Idea 4:

Try-On Truth. Customer tries 3 jackets in the fitting room. Phone takes a quick photo of each (opt-in, ephemeral). AI shows side-by-side: silhouette, fit-line differences, which one matches your apparent preference. Captures the try-on signal which today vanishes the moment the customer walks out. Wedge: net-new dataset (try-on attempts, not purchases), valuable to brands and retailers, novel UX for shoppers.

Idea 5:

Fit Translator. Each brand sizes differently — a known pain that nobody has solved. Scan a jacket, app tells you: "you're a Patagonia M; this Arc'teryx runs small, try L." Builds a personal cross-brand size graph from past purchases + returns. Wedge: a real data asset that compounds across visits and is genuinely defensible — once it knows you across 10 brands, switching cost is high.


Idea 6:
Repair vs Replace. Scan an old jacket showing wear. App estimates: repairable (where, cost, turnaround) vs replace-it economics. Plugs into brand repair programs (Patagonia Worn Wear, Arc'teryx ReBird). Wedge: ESPR-aligned, outdoor-demographic-aligned, and almost no consumers know repair is even an option until they're standing in a store.


Idea 7:
Physical stores solve many problems but they systematically fail at one: simulating the actual use environment. You can't know how a jacket performs in wind and rain by standing under fluorescent lights. You can't know how a boot feels after four hours on a trail by walking twenty steps on carpet. Customers know this, which is why they hesitate, and why online return rates for outdoor gear are catastrophically high.
The unsolved problem: no one has seriously tried to bring the environment into the store rather than bringing the product to the customer.
The idea: at the moment a customer scans a product they're considering, the system pulls real environmental data — the actual weather forecast for their stated destination, real trail surface data, elevation profiles — and maps it against the product's technical specs to give a situational performance score. Not "waterproof rating: 20,000mm" but "for your Mont Blanc hike on the forecasted date, this jacket will keep you dry. This other jacket won't — here's the specific threshold it fails at."
The reason this is hard and unsolved: it requires bridging product spec databases, real-world environmental APIs, and use-case inference in a way that is accurate enough to be trusted. If you get it wrong, you destroy credibility. Getting it right requires a level of product-to-condition mapping that doesn't exist in any structured database today — it would need to be built from scratch, probably by combining manufacturer specs with real user outcome data.
