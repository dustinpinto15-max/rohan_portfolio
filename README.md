# Rohan Nakte — Marketing Portfolio

A fast portfolio site with a dark theme, a coral-red accent and the Inter font.

- **Built with:** Astro. All pages are static HTML.
- **Hosting:** Vercel, on the free plan.
- **Editing:** Decap CMS at `yourdomain.com/admin`. You log in with GitHub.
- **Contact form:** Web3Forms (free). Each message is sent to your email.
- **Tracking:** Google Tag Manager with dataLayer events for GA4.
- **SEO:**
  - meta tags and Open Graph
  - Person, WebSite and Article schema
  - sitemap.xml and robots.txt
  - a separate page for each case study

**Pages**
- `/` is the home page.
- `/case-studies/` lists all case studies.
- `/case-studies/<page-address>/` is one full case study.

**Private notes:** `CASE-STUDY-NOTES.md` shows which numbers come from your resume and which are estimates. It also has interview answers. This file is **not** published on the site.

---

## 1. Where the content lives

All the text sits in `src/data/*.json`. Edit it in the admin panel. You do not need to touch code.

| Admin section | File | What it controls |
|---|---|---|
| 1. Site Settings | `settings.json` | Name, photo, SEO, GTM ID, Web3Forms key, contact details, CV |
| 2. Hero | `hero.json` | Name, intro, buttons, 4 stat cards |
| 3. Top Clients | `clients.json` | Client names, industries, optional logos |
| 4. Experience | `experience.json` | Jobs, highlights and education |
| 5. Case Studies | `case-studies.json` | Home page tabs **and** the full case study pages |
| 6. Skills & Tools | `skills.json` | Skill cards and the tools grid |
| 7. Certifications | `certifications.json` | Shown in two places: the Experience sidebar and the Skills section |
| 8. What I Bring | `values.json` | The 4 value points |
| 9. Contact | `contact.json` | Contact text and form messages |
| 10. FAQ | `faq.json` | Questions and answers |

**Text styling in intros and subtitles:**
- `[[text]]` shows the text in **red**.
- `**text**` shows the text in **bold white**.

**To add a case study:** in admin → Case Studies, click **Add**. Fill in every field. The **Page Address** becomes the link, for example `/case-studies/my-new-project/`.

---

## 2. Run it on your computer

You need Node.js 22 or newer.

```bash
npm install
npm run dev        # open http://localhost:4321
```

To edit content locally in the admin panel:

```bash
npm run dev        # terminal 1
npm run cms        # terminal 2
# open http://localhost:4321/admin
```

---

## 3. Put it on GitHub

1. Create a new **private** repository on GitHub.
2. Upload this folder to it. Do not upload `node_modules`, `dist` or `.vercel`.
3. Open `public/admin/config.yml` and change 3 things:
   - `repo:` → your GitHub username and repository name, e.g. `rohannakte/portfolio`
   - `base_url:` → your live site address
   - `site_url:` and `display_url:` → your live site address

---

## 4. Deploy on Vercel

1. Go to vercel.com → **Add New → Project** → import your GitHub repository.
2. Vercel detects **Astro** by itself. Leave the build settings as they are, then click **Deploy**.
3. Your site is live on a `*.vercel.app` link in about a minute.

Every change you publish in the admin panel is saved to GitHub. Vercel then rebuilds the site by itself.

---

## 5. Turn on the admin login (one-time, about 5 minutes)

The admin panel logs in through GitHub. Two small Vercel functions handle this: `/api/auth` and `/api/callback`.

1. On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - **Homepage URL:** your live site, e.g. `https://rohannakte.com`
   - **Authorization callback URL:** `https://rohannakte.com/api/callback`
2. Copy the **Client ID**. Then click **Generate a new client secret** and copy that too.
3. In Vercel, open your project → **Settings → Environment Variables**. Add these two variables:
   - `GITHUB_CLIENT_ID` = your Client ID
   - `GITHUB_CLIENT_SECRET` = your Client Secret
4. **Redeploy** the project: Deployments → ⋯ → Redeploy.
5. Open `yourdomain.com/admin` and click **Login with GitHub**.

> **Testing on the `vercel.app` link first?** Use your `vercel.app` address everywhere in steps 1 and 3 of section 3, and in the OAuth app. When you connect your own domain, update all of them.

---

## 6. Get contact form messages by email (Web3Forms)

1. Go to web3forms.com. Enter the email address where you want messages, then click **Create Access Key**.
2. Copy the key from your email.
3. In admin → **Site Settings**, paste it into **Web3Forms Access Key**. Then publish.

- The free plan allows 250 messages a month.
- A hidden spam trap blocks bots.
- Until the key is added, the form shows a message asking people to email you instead.

---

## 7. Connect your own domain

1. In Vercel, go to **Settings → Domains → Add**. Type your domain.
2. Add the DNS records Vercel shows you, at your domain provider (GoDaddy, Hostinger, etc.). HTTPS turns on by itself.
3. Update the domain in these places:
   - admin → **Site Settings → Site URL**
   - `public/admin/config.yml` (`base_url`, `site_url`, `display_url`)
   - the GitHub OAuth app URLs

---

## 8. Tracking (GTM + GA4)

1. Create a GTM container. Then paste its ID (e.g. `GTM-ABC1234`) into **Site Settings → Google Tag Manager ID**.
2. If this field is empty, no tracking loads at all.

### Events the site sends to `dataLayer`

| Event | When it fires | Parameters |
|---|---|---|
| `cv_download` | A "Download CV" button is clicked | `cta_text`, `cta_location`, `file_url` |
| `cta_click` | Schedule a Call, Read Full Case Study, Discuss This Project or Get in Touch is clicked | `cta_text`, `cta_location` |
| `case_study_view` | A case study tab is opened, or a full case study page loads | `case_study_title`, `view_type` |
| `form_submit` | The contact form is sent successfully | `form_name`, `hiring_company`, `hiring_role` |
| `outbound_click` | An email, phone, LinkedIn, Instagram or external link is clicked | `link_type`, `link_url`, `link_text`, `cta_location` |

### Setup in GTM (about 10 minutes)

1. **Tag:** Google Tag, with your GA4 Measurement ID. Trigger: *Initialization – All Pages*.
2. **Variables:** create a Data Layer Variable for each parameter above.
3. **Trigger:** Custom Event. Set the event name to `cv_download|cta_click|case_study_view|form_submit|outbound_click` and tick **Use regex matching**.
4. **Tag:** GA4 Event.
   - Event name: `{{Event}}`
   - Add each parameter as an event parameter.
   - Use the trigger from step 3.
5. In GA4, mark `form_submit` and `cv_download` as **Key events**.
6. Test with GTM **Preview** mode, then click **Publish**.

---

## 9. Checklist before you share the link

- [ ] Check every number marked **Estimate** in `CASE-STUDY-NOTES.md`.
- [ ] Add your real **LinkedIn URL** in Site Settings.
- [ ] Add your **Web3Forms key**.
- [ ] Add your **GTM ID**.
- [ ] Optional: upload client logos in admin → Top Clients. Transparent PNGs look best.
- [ ] Add the site to **Google Search Console**, then submit `https://yourdomain.com/sitemap.xml`.
- [ ] Check the LinkedIn share preview with the LinkedIn Post Inspector.

---

## 10. Project structure

```
public/
  admin/            → CMS (index.html + config.yml)
  cv/               → your CV (references removed)
  character/        → hero character layers (body, neck, head, depth maps, still picture)
  clients/          → client logos (white + colour)
  uploads/          → images and files uploaded from the CMS
  og-image.png, rohan-nakte.webp, favicon.svg
src/
  data/             → all website content (JSON)
  components/       → Nav, Hero, Character, Clients, Experience, CaseStudies, Snapshot, Skills, Contact, Footer, Icon
  scripts/
    effects.js      → loader, smooth scroll, cursor, day/night, reveals, tilt, counters, speech bubble
    world3d.js      → the 3D growth marketing objects that travel down the page (Three.js)
    character3d.js  → the hero character: 3D head turn, eyes, typing (Three.js)
  layouts/Base.astro → SEO tags, schema, GTM, click tracking, theme, loader, 3D canvas
  pages/
    index.astro, 404.astro, sitemap.xml.js, robots.txt.js
    case-studies/   → index page + one page per case study
    api/            → GitHub login for the admin panel (Vercel functions)
  styles/global.css → design tokens and all styles
scripts/add-headers.mjs → adds security headers to the Vercel build
CASE-STUDY-NOTES.md     → private interview notes (not published)
```

---

## 11. 3D, motion and day/night mode

### What the visitor sees
| Effect | Where | File |
|---|---|---|
| First-visit loader with a 000 to 100% counter (once per browser session) | Whole site | `src/scripts/effects.js`, `src/layouts/Base.astro` |
| **One 3D object per section, and it travels with you down the page.** A growth chart with a rising arrow (Hero), a megaphone (Clients), a rocket (Experience), a target with an arrow in the bullseye (Case Studies), a funnel that turns leads into coins (Skills), and a paper plane (Contact). Each one sits beside the section heading, then waits at the side while you read | Whole site | `src/scripts/world3d.js` |
| The object leans toward the mouse circle. When the circle is on it, the object grows and the circle grows too. Click it and it spins. A few small coins float at the page edges (none on phones). The whole scene is kept slow and small so the text stays the focus | Whole site | `src/scripts/world3d.js` |
| Circle cursor that follows smoothly, grows on links, and shows labels like "View", "Drag", "Hello" | Whole site (mouse only) | `src/scripts/effects.js` |
| Magnetic buttons that pull toward the mouse | Buttons and the day/night switch | `src/scripts/effects.js` |
| Smooth inertial scrolling (Lenis) | Whole site | `src/scripts/effects.js` |
| Headings reveal word by word | Section titles | `src/scripts/effects.js` |
| 3D character whose head and eyes follow the mouse circle. When the mouse stops, he looks back at his laptop and types | Hero | `src/scripts/character3d.js` |
| Client logo marquee that leans with scroll speed | Top Clients | `src/components/Clients.astro` |
| 3D card tilt with glare, count-up numbers | Stats, cards | `src/scripts/effects.js` |
| Tools sphere: every tool is a chip with its logo and name, on a ball that spins slowly. Drag it to spin it yourself | Skills | `src/components/Skills.astro`, `src/scripts/effects.js` |
| Day/night switch with a circle wipe | Nav bar | `src/components/Nav.astro`, `src/scripts/effects.js` |

### The hero character
Your 3D character sits at the desk in the hero.

- **Mouse moving:** his head and eyes follow the mouse circle, left, right, up and down. The eyes move first, then the head.
- **Mouse still for about 2 seconds:** he looks back down at the laptop and types. His fingers move one at a time, in short bursts with small pauses. Now and then he looks up, says the next speech bubble line, and goes back to work.
- **His face:** four mouths are blended live: calm (closed), "oo", "ah" and a smile. He is calm while he works. When he notices the mouse he does a small "oh!" with raised eyebrows, then smiles. He smiles while the mouse circle is near him, and his eyes narrow a little when he smiles.
- **Speech bubble and lip sync:** the line types out letter by letter and his mouth moves with the letters at the same speed (vowels open the mouth, m, b and p close it). On a question his eyebrows go up and his head tilts. Then he smiles and goes back to work.
- **Phone:** he works at the laptop and looks up now and then. He looks at the place you touch.
- **Click or tap him:** he nods and shows the next speech bubble line.
- **How it works:** the picture is split into layers in `public/character/`:
  - `body.webp` is the desk scene without the head and neck.
  - `neck.webp` is the neck. It sits under the jacket, so it can lean and twist with the head.
  - `head.webp` is the smiling head. `head-calm.webp`, `head-oo.webp` and `head-ah.webp` are the same head with a closed mouth and two talking mouths. `head-depth.png` tells the code how deep each part is (nose near, ears far). So the head turns like a real 3D head, not like a flat sticker.
  - `body-data.png` holds the depth of the desk scene and the shape of the typing hand. The three fingers are set in the body shader in `character3d.js`.
  - `scene.webp` is the still picture. It shows first, and it stays if the visitor has "reduce motion" on or the browser has no 3D.
- The eyes are drawn in code, so the pupils can move and the lids can blink.
- All motion uses soft springs, so it starts and stops gently.
- The 3D growth chart floats in the box above the books (`#hero-object`) and stays with it while you scroll.
- **Edit the bubble lines:** admin → Hero → *Character Speech Bubble Lines*.
- **Tune the motion:** the numbers at the top of `src/scripts/character3d.js` (`MAX_YAW`, `MAX_PITCH_UP`, `MAX_PITCH_DOWN`, `IDLE_AFTER`).
- **To use a new picture:** the layers must be cut again, because the eye, jaw and hand positions are measured from this exact image. Send the new art and ask for a re-cut.

### Which 3D object shows in each section
Set on the section tag, so you can change it without touching the 3D code:
```html
<section data-shape="target" data-side="left" data-scale=".85" data-opacity=".5">
```
- `data-shape`: `chart`, `megaphone`, `rocket`, `target`, `funnel` or `plane`
- `data-side`: `left`, `center` or `right`
- `data-scale`: size while it waits at the side (1 = normal)
- `data-opacity`: how strong it looks while it waits at the side (0 to 1)
- `data-anchor` (optional): a box on the page the object should sit inside, e.g. `#hero-object`
- An empty `<div class="shape-spot" data-shape-spot></div>` inside the section heading is the object's "spot". The object is shown big and clear there while the heading is on screen. Its size and place are set by `.shape-spot` in `src/styles/global.css`.

### Day / night mode
- Night mode is the default. Change it in admin → Site Settings → **Default Theme** (Night, Day, or follow the visitor's device).
- A visitor's own choice is saved in their browser and wins next time.
- All colours live in `src/styles/global.css` at the top: night values under `:root`, day values under `:root[data-theme="light"]`.
- In day mode, client logos show in colour.

### Speed
- The 3D code (Three.js) loads right after the page and fades in. The still character picture shows first, so the hero never looks empty.
- It stops drawing when the tab is hidden or the hero is off screen. Phones use fewer floating pieces.
- If a browser has no 3D support, the page still works and looks complete.

### Accessibility
- "Reduce motion" on the visitor's device turns off the loader, smooth scroll, reveals, tilt, marquee and spinning. The 3D object still changes with scroll but without idle motion, and the character stays as a still picture.
- The circle cursor only appears for a mouse. Touch screens keep normal scrolling and tapping.
- Every button and link keeps a visible keyboard focus ring.

### Client logos
- They live in `public/clients/`. Each brand has two files:
  - `name.png` is the white logo for night mode.
  - `name-color.png` is the original logo. It shows on hover and in day mode.
- To add a client, upload both files in admin → Top Clients.

### Tools & Platforms sphere
- Edit in admin → Skills & Tools → Tools.
- Each tool has a name, a category and a logo.
- **Logo, three ways:**
  1. **Logo Name**, written as `set:name`. The logos come from open icon sets that are installed with the project:
     - `logos:` full-colour logos, for example `logos:google-ads` (browse at icon-sets.iconify.design/logos)
     - `fa6:` Font Awesome brand icons, for example `fa6:amazon`
     - `vsc:` VS Code file icons, for example `vsc:file-type-excel`
     - `si:` Simple Icons, for example `si:semrush`
  2. **Own Logo File**: upload a square logo. It is used instead of the Logo Name.
  3. Neither: the chip shows the tool's initials.
- These six are not in any of the sets, so they show initials: AppsFlyer, Ahrefs, LeadSquared, Klaviyo, AdCreative.ai and Canva. Download the logo from each brand's press page and upload it as **Own Logo File**.
- **Brand Colour** is used for the glow, for one-colour logos and for initials.
- With "reduce motion" on, or without JavaScript, the tools show as a plain list of the same chips.

### Content flow (who the site talks to)
The site speaks to two visitors: a team hiring a performance marketing lead, and a founder who wants a freelancer.
1. **Hero**: what you do in one line, who it is for, and two buttons (Work with me, Download CV).
2. **Clients**: trust.
3. **Work With Me**: two cards, one per visitor. Each button opens the contact form with the right option picked. Edit in admin → Work With Me.
4. **Results** (case studies): proof.
5. **Experience**, 6. **Skills and tools**, 7. **Contact and FAQ**.

To change the order, move the lines in `src/pages/index.astro` and the links in `src/components/Nav.astro`.

### Keeping the background calm
The 3D objects are small and slow on purpose, so the words stay the focus. One number controls this: `CALM` at the top of `src/scripts/world3d.js` (0 = very still, 1 = lively). The size of the object beside each heading is `.shape-spot` in `src/styles/global.css`.
