# Before you launch this publicly

You asked for a "real and legal" Instagram SMM panel. The code in this repo is real
and production-shaped — but "legal" depends on what you sell and where you operate,
and there's no code change that makes that decision for you. This note is the honest
rundown so you can make it with full information. **It is not legal advice** — talk
to an actual lawyer in your jurisdiction before you launch.

## 1. Instagram/Meta's own rules

Instagram's [Terms of Use](https://help.instagram.com/581066165581870) and Community
Guidelines prohibit buying or selling fake engagement (followers, likes, views,
comments) and using third-party services to inflate metrics. This isn't a criminal
law — it's Instagram's own contract with its users — but it means:

- Instagram can remove delivered followers/likes at any time.
- Instagram can restrict, shadow-limit or suspend accounts that use these services —
  **your customers' accounts**, not yours.
- You have no control over Instagram's enforcement and no guarantee delivered
  engagement stays.

The app's Terms of Service template (`/terms`) discloses this to customers up
front and makes clear they're accepting that risk. Keep that disclosure — removing
it doesn't remove the risk, it just stops telling customers about it.

## 2. Payment processors

This is usually the practical blocker, not criminal law. Most mainstream payment
processors' acceptable-use policies explicitly restrict or prohibit businesses that
sell fake engagement / followers / likes — PayPal, Stripe, and many banks' merchant
agreements name this category directly. Before wiring up any payment gateway:

- Read that specific processor's acceptable-use/prohibited-business policy yourself.
- Consider gateways that are more commonly used by this industry in your market
  (crypto, certain regional UPI aggregators) — but check their terms too; this
  changes often and varies by country.
- Getting a merchant account suddenly frozen mid-business, with customer funds
  inside it, is the most common way panels like this actually fail — plan around it.

## 3. Consumer protection / advertising law

In several jurisdictions, selling fake engagement has been treated as a deceptive
trade practice (it creates false social proof) rather than a copyright or platform
issue — for example, the item has drawn FTC attention in the US. This varies a lot
by country and by exactly what you advertise ("grow your real audience" claims are
riskier than plainly describing what's delivered). A local lawyer can tell you where
your market's line actually is.

## 4. Trademark / branding

Don't name your business or domain in a way that implies Instagram/Meta owns,
endorses or partners with it (e.g. nothing like "Instagram Official Panel"). The
footer already includes a "not affiliated with Instagram or Meta" line — keep it,
and keep your branding (name, logo, domain) clearly your own.

## 5. What you should NOT sell through this

Regardless of the above, don't use this panel to target content that's illegal,
sexually exploitative of minors, promotes violence, or infringes someone else's
rights — the Terms of Service template already reserves the right to refuse and
cancel such orders (`/terms`, section 4). Enforce it.

## 6. What's already been done to keep this honest

- No fabricated testimonials, reviews, or "10,000+ happy customers"-style invented
  stats anywhere in the templates — the homepage stats are computed live from your
  own database (real user/order counts), starting at zero.
- The risk disclosure above is written into the public Terms of Service, not buried.
- Refund policy, privacy policy and what data goes to your upstream provider are
  all disclosed in plain language.

## Practical next steps

1. Register an actual business entity if you're operating commercially — this also
   determines which governing-law clause to put in `/terms` (currently a
   placeholder).
2. Get ~30 minutes with a lawyer in your country to sanity-check the Terms of
   Service / Refund Policy templates and your payment approach.
3. Pick a provider and payment method with your eyes open to sections 1–2 above.
