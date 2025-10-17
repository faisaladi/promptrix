# Static Landing Page Spec

Goal: Present Promptrix succinctly, drive sign-ups, and showcase core value.

## Brand & Theme
- Colors: white `#FFFFFF`, near-black `#0A0A0A`, accent yellow `#FFC107`.
- Typography: Titles — Montserrat ExtraBold 800; Body — Open Sans 400/600.
- Logo: `public/promptrix_logo.svg` (alt: "Promptrix logo").
- Tone: Clear, professional, minimal.

## Information Architecture
- Header
  - Left: logo + wordmark.
  - Right: primary CTA `Get Started`, secondary `View Public Prompts` (link to `/p`).
- Hero
  - H1: "One‑stop portal to manage & share prompts & workflows."
  - Subcopy: "Design, iterate, and publish prompts that your team can trust."
  - CTAs: `Get Started` (primary), `Explore examples` (secondary anchor to Features).
  - Visual: logo or subtle product screenshot/illustration.
- Features (three cards)
  1) Prompt Library
     - Title: "Organize your prompts"
     - Copy: "Curate versions, tags, and ownership — all in one place."
  2) Share to Public
     - Title: "Publish with one link"
     - Copy: "Share read‑only prompts publicly; let others copy or save."
  3) Chat & Iterate
     - Title: "Test in chat"
     - Copy: "Run prompts in a chat interface and iterate fast."
- Upcoming Features (list)
  - Evaluate prompt performance
  - Create prompt chaining / workflows
  - Manage & collect prompts as a team
  - Bring Your Own Key (BYOK)
  - Integrate with n8n or other automation platforms
- CTA Section
  - Headline: "Build a reliable prompt practice"
  - Button: `Get Started` (auth/signup), text link: `Contact` (mailto or form).
- Footer
  - Links: Docs, Privacy, Terms, GitHub.
  - Copyright: "© Promptrix".

## Naming Guidance
- Use "Prompt Library" for the top‑level concept; it's familiar and implies curation.
- Use "Collections" inside the library as optional grouping sets (teams, projects, topics).

## Content & Copy
- Title: "Promptrix"
- Tagline: "One‑stop portal to manage & share prompts & workflows"
- Value bullets:
  - "Version prompts and keep a single source of truth"
  - "Share publicly or invite collaborators with granular roles"
  - "Test prompts in chat and ship faster"

## Layout & Styles
- Container: max‑width ~`1200px`, responsive grid.
- Spacing: generous 24–40px vertical rhythm.
- Buttons: black text on yellow for primary; black outline for secondary.
- Cards: white background, subtle shadow, 8px radius.
- Accessibility: contrast ratio ≥ 4.5:1; focus outlines visible; keyboard‑navigable.

## Assets & SEO
- Favicon: `public/favicon.ico`.
- OG image: simple logo on white with accent border.
- Meta title: "Promptrix — Manage & share prompts & workflows".
- Meta description: "A clear, professional portal to organize, test, and share prompts.".

## Implementation Checklist
- Add landing route (`/`) or update `src/pages/Index.tsx` with this structure.
- Import Google Fonts: Montserrat (800) and Open Sans (400/600).
- Use `public/promptrix_logo.svg` in header and hero.
- Build three feature cards; add Upcoming list.
- Wire CTAs: `Get Started` → Auth; `View Public Prompts` → `/p` index or examples.
- Ensure theme tokens and accessibility are respected.

## Theme Tokens (CSS)
```css
:root {
  --bg: #FFFFFF;
  --text: #0A0A0A;
  --accent: #FFC107; /* accessible yellow */
  --muted: #6B7280;  /* gray-500 */
}
body { background: var(--bg); color: var(--text); font-family: 'Open Sans', system-ui, sans-serif; }
.h1 { font-family: 'Montserrat', sans-serif; font-weight: 800; }
.btn-primary { background: var(--accent); color: var(--text); }
.btn-secondary { border: 1px solid var(--text); color: var(--text); background: transparent; }
.card { background: #fff; border-radius: 8px; box-shadow: 0 8px 20px rgba(0,0,0,0.05); }
```

## Accessibility Notes
- Provide `alt` for logos/imagery; avoid text in images for key copy.
- Ensure CTAs have clear labels; respect reduced motion if adding animations.
- Test keyboard traversal and focus ordering.