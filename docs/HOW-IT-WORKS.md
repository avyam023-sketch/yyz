# How Clannco works, step by step

Clannco turns a buyer's property enquiry into a **personal web page made just for that buyer**. You send it on WhatsApp, the buyer explores the homes you picked, you see what they looked at, and they can ask for a viewing from the page.

You never build a page by hand. You record the enquiry, tick the homes to show, and the platform builds the page from your property catalogue.

---

## The big picture

```
Buyer enquires
   → You create the enquiry (name, WhatsApp number, what they want)
   → The platform suggests matching homes
   → You pick the homes and click "Generate Personalised Microsite"
   → You click "Send via WhatsApp" and press Send in WhatsApp
   → The buyer opens their page, greeted by name
   → You see what they opened (floor plans, brochure, payment plan…)
   → The buyer requests a viewing
   → You confirm the viewing time
```

---

## Part 1: One-time setup (already done)

| Step | What it does | Status |
|---|---|---|
| 1. Supabase project | Stores all data, logins and files securely | ✅ Connected |
| 2. Database migrations | Creates the tables and security rules | ⚠️ 3 of 4 applied: apply `20261027120000_price_on_request.sql` |
| 3. Sample data | A demo organisation with 2 fictional developments, labelled **Sample** | ✅ Seeded |
| 4. Opus One | Your real development, with its cover images and brochure | ✅ Added; **units still needed** |
| 5. Code on GitHub | Your code is backed up and ready to deploy | ✅ `adi26nova12/gb-reality` |

---

## Part 2: Prepare a development (once per project)

### Step 1: Open the development
**Developments → Opus One**

What's already there:
- **Cover images.** A wide one for computers and a tall one for phones. Both were made with Higgsfield from your brochure renders, using 11 credits. Each buyer's name is written on top of them.
- **Brochure.** The full Opus One PDF. Buyers read it inside their page.

### Step 2: Fill in the details (optional, recommended)
Click **Edit** and add the location, developer, description, amenities, payment plan and sales contact. Everything you add here appears on every buyer's page for this development.

### Step 3: Add the units ⚠️ required
**Properties → Add property**, then for each unit fill in:
- Unit reference (e.g. *T1-1204*)
- Configuration (e.g. *3BHK*), bedrooms, bathrooms, area
- **Price** (type it the Indian way: `1.2Cr` or `95L`)
- **Show buyers "Price on request"** (optional): for signature units. Buyers see *Price on request* instead of the figure; your team still sees the price, and it is still used for budget matching
- Availability (*Available / Reserved / Sold*)
- Floor plan (upload the typical floor plan PDF or an image)
- Photos (optional)

> Without at least one **available** unit, you can't make a page for an Opus One buyer.

---

## Part 3: Handle a new enquiry (every buyer)

### Step 4: Create the enquiry
Click **New Enquiry** (top right). Enter:
- **Buyer name**, e.g. *Ahmed Khan*
- **WhatsApp number**, e.g. `98123 45678` (+91 is added automatically)
- **Development:** Opus One
- **Configuration:** e.g. 3BHK
- **Budget:** e.g. `1Cr` to `1.5Cr` (optional but helps matching)

Click **Save and match properties**.

### Step 5: Review the matching homes
The platform sorts your units into three groups, and each home says *why* it was suggested:

| Group | Meaning |
|---|---|
| **Exact matches** | Right development, right configuration, within budget |
| **Close alternatives** | Same development, but a different size or over/under budget |
| **Other developments** | Right size and budget, in another of your projects |

Sold and reserved units are **never** suggested. Tick the homes you want to show; exact matches are pre-ticked.

### Step 6: Generate the page
Choose how long the link should work (30/60/90 days or no expiry), add an optional personal note, and click **Generate Personalised Microsite**.

You get a **secure private link**, e.g. `…/p/aA_1ioafLbzm…`. It can't be guessed, and it contains no phone numbers or names.

### Step 7: Preview it (optional)
Click **Preview** to see exactly what the buyer will see. Previews are **not** counted as buyer visits.

### Step 8: Send it on WhatsApp
Click the green **Send via WhatsApp** button. WhatsApp opens with:
- the buyer's number already filled in,
- a ready-written message: *"Hi Ahmed, thank you for your interest in Opus One… You can explore your selection here: [link]"*

**You press Send yourself.** The platform never sends WhatsApp messages on its own.

When WhatsApp shows the link, the preview card shows the Opus One image with **"Prepared exclusively for Ahmed"**. This only works once the site is live on a public web address (see Part 6).

### Step 9: Mark as contacted
After you've pressed Send, come back and click **"I sent the message — Mark as Contacted"**. The enquiry only becomes *Contacted* when you confirm it, never just because you clicked the WhatsApp button.

### Step 10: (Optional) Send the personal welcome photo
On the same enquiry page, under **Personalised welcome image**, click **Download for WhatsApp (4:5)**. It's the Opus One image with the buyer's name on it. Attach it in the WhatsApp chat as a photo. Making one for a new buyer is free: no Higgsfield credits are used per buyer.

---

## Part 4: What the buyer sees

When Ahmed opens the link on his phone:

1. **A welcome screen** with the Opus One image and his name: *"Prepared exclusively for **Ahmed**, Welcome to Opus One"*
2. **"Your homes"**: only the units you picked, each named as a residence (*Residence T1-1204*, *Penthouse T1-3001*) with its view or aspect underneath, then the price (or *Price on request*) and the specifications
3. **View details** and **Floor plan** buttons on each home
4. **Life at Opus One**: description, amenities and gallery
5. **Payment plan**: tap to expand
6. **The full brochure**, readable on the phone, with page turning and zoom
7. **Location**: the map loads only when he taps it
8. **Request a viewing** form: date, morning/afternoon/evening, which home
9. **WhatsApp / Call** buttons to reach you
10. **A privacy notice** explaining what is recorded

He doesn't need an account or an app. It's just a web page.

If you revoke the link, or it expires, he sees a polite "this link is no longer active" page instead of any property details.

---

## Part 5: Follow up

### Step 11: See what the buyer looked at
Open the enquiry. The **Engagement timeline** shows real events with times (IST), for example:

```
10:04  Microsite generated by Priya
10:07  WhatsApp opened with the message (sending not confirmed)
10:12  Microsite opened
10:15  Floor plan opened — 3BHK · T1-1204
10:17  Brochure opened
10:18  Brochure page 4 displayed
10:21  Viewing request submitted
```

Refreshing the page doesn't create duplicate entries, and nothing is guessed: "page displayed" means it was on screen, not that it was read.

You also get **notifications** (the bell icon) when a buyer first opens their page or requests a viewing.

### Step 12: Handle the viewing request
**Viewing Requests**, then **Manage**:
- Call or WhatsApp the buyer straight from there
- Set the status to **Confirmed** and pick the date and time
- Later, mark it **Completed** or **Cancelled**

The buyer was told *"The property team will contact you to confirm"*, so nothing counts as confirmed until you confirm it here.

### Step 13: Update the enquiry status
Statuses move forward automatically when it's safe (e.g. *Engaged* when the buyer opens the page). You can always change them by hand: New → Microsite generated → Contacted → Engaged → Viewing requested → Viewing scheduled → **Converted** or **Lost**.

### Step 14: Change the homes later (optional)
On the enquiry, click **Change properties**. The **same link** now shows the new selection; no need to resend it. Prices and availability on the page always come live from your catalogue: if a unit is sold, the buyer's page shows it as sold, without a price.

---

## Part 6: Using it on your phone

| Option | How | Works when |
|---|---|---|
| **Same Wi-Fi** | Open `http://<your PC's Wi-Fi IP>:3000` on your phone (run `ipconfig` on the PC to find it) | Your PC is on and the dev server tab is running |
| **Tailscale** | Open `http://<your PC's Tailscale IP>:3000` (shown as **Network** when the dev server starts) | Same as above, from anywhere on your Tailscale network |
| **Go live (recommended)** | Deploy the GitHub repo on **Vercel** | Always on, a real `https://` address, works for buyers and WhatsApp previews |

**To go live on Vercel:**
1. Go to **vercel.com/new** and import `adi26nova12/gb-reality`
2. Add these environment variables (copy them from your `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `MICROSITE_TOKEN_SECRET`
   - `NEXT_PUBLIC_SITE_URL`: your Vercel address, e.g. `https://gb-reality.vercel.app`
3. Click **Deploy**
4. In Supabase → Authentication → URL Configuration, set the **Site URL** to the same address

> Links made on your PC (`localhost`) only work on your PC. Generate the links you send to real buyers from the live site.

---

## Part 7: Other screens

| Screen | What it's for |
|---|---|
| **Overview** | Enquiry, visit and viewing totals, recent activity, upcoming viewings |
| **Enquiries** | Every buyer, with search, filters and status |
| **Properties / Developments** | Your catalogue: the single source of truth for prices and availability |
| **Microsites** | Every link you've sent: preview, revoke, see activity |
| **Engagement Analytics** | Visits over time, by development, and enquiry-to-viewing conversion |
| **Viewing Requests** | Requests that need action, plus upcoming confirmed viewings |
| **Settings** | Your name and WhatsApp number (shown to buyers), notification choices, **Manage team** |

---

## What it deliberately does *not* do

- ❌ Send WhatsApp messages automatically (you always press Send)
- ❌ Claim a message was delivered or read
- ❌ Mark a viewing as confirmed before you confirm it
- ❌ Show fake numbers: every figure comes from real activity
- ❌ Use cookies, ad trackers or fingerprinting on buyer pages
- ❌ Put phone numbers or names in links
