# HORIZON Design Exploration

## Three Directions

### 1. Quiet Observatory
**Very Brief Intro:** A focused, cinematic developer workspace inspired by precision instruments and editorial software. Deep navy surfaces, restrained cobalt light, and careful typographic hierarchy make complex code feel navigable.

**Probability:** 0.037

### 2. Paper Terminal
**Very Brief Intro:** A high-contrast light technical studio that combines documentation margins, monospaced annotations, and print-like hierarchy. It feels methodical and studious rather than corporate.

**Probability:** 0.082

### 3. Signal Room
**Very Brief Intro:** A dark operational console built around status signals, dense metadata, and compact panels. The mood is calm and analytical, with no decorative sci-fi excess.

**Probability:** 0.016

## Chosen Approach: Quiet Observatory

### Design Movement
**Editorial software minimalism** meets the layered depth and spatial economy of mature developer tools. The visual language references code editors and observatory instruments rather than generic SaaS dashboards.

### Core Principles
1. **Workspace first:** The editor and output are always the strongest visual objects; navigation and marketing copy remain intentionally subordinate.
2. **Measured contrast:** Use navy-black foundations, quiet slate surfaces, and carefully bounded blue-violet accents to guide attention without an over-lit neon aesthetic.
3. **Useful density:** Preserve generous breathing space around headings while keeping control groups, lists, and document views compact enough for real work.
4. **Explainability in the interface:** Surface language, confidence, scope, analysis state, and export affordances as readable metadata rather than hiding product logic behind vague AI language.

### Color Philosophy
The base is a nearly black blue, designed to feel stable in long coding sessions. Neutral graphite panels establish depth through value shifts rather than exaggerated glass. The signature **Horizon Blue** anchors interactivity and communicates reliability; violet is only introduced as the destination of the word “Clarity” and select analysis signals, symbolising the movement from source code to understanding.

### Layout Paradigm
The shell is an **instrument panel**: a fixed vertical navigation rail, a thin control strip, then a deliberately left-biased content field. A compact hero functions as a preface above a persistent two-column workbench instead of consuming the page like a marketing landing screen. On smaller screens, the app becomes a linear work sequence, with input first and analysis second.

### Signature Elements
1. A geometric horizon mark: a rising line crossing a semicircle, used at a useful 32px scale in the rail and as the favicon.
2. Hairline “scanline” separators and muted coordinate-dot texture that evoke a technical instrument without visual noise.
3. An analysis pulse: a small, restrained blue status light and changing progress label which make AI work feel observable.

### Interaction Philosophy
Every interaction should make the working state clearer. Primary actions have solid, confident surfaces; secondary controls are quiet outlines; selection uses an inset horizon-blue signal. The keyboard command surface, file dropping, editor updates, copied state, and the active function all respond immediately and predictably.

### Animation
Use only short transform and opacity transitions under 220ms with `cubic-bezier(0.23, 1, 0.32, 1)`. On entry, content fades upward by 6px with a 35–60ms stagger; there are no looping gradients, floating cards, or large ambient animations. The status light may pulse slowly only while analysis is running. Reduced-motion users receive no non-essential movement.

### Typography System
**Manrope** is the interface and reading face, selected for compact clarity at small UI sizes and confidence in display weights. **IBM Plex Mono** is reserved for code, function signatures, language labels, and metadata. Headlines use Manrope 700 with tight tracking; labels use Manrope 600 at 11–12px with controlled uppercase tracking; body copy uses 14–15px with relaxed leading; code stays at 13px to preserve information density.

### Brand Essence
**HORIZON turns unfamiliar code into a clear, reviewable developer narrative for builders joining, maintaining, and shipping software.**

**Personality:** Precise, composed, illuminating.

### Brand Voice
The product speaks like a capable senior engineer: direct, evidence-aware, and never theatrical. Headlines are declarative; CTAs name the action and result; microcopy says what the system can or cannot determine.

Example headline: “Map the logic before you modify it.”

Example CTA: “Generate documentation for 4 selected functions.”

### Wordmark & Logo
The wordmark uses spaced Manrope letterforms with a custom split in the **O**, echoing a horizon line. The standalone mark is a cobalt horizon line bisecting a blue-violet crescent; it remains recognisable in one colour and contains no text.

### Signature Brand Color
**Horizon Blue — #75A7FF.** It is used sparingly for primary actions, active-navigation signal, focus states, and trustworthy system status.

## Style Decisions

- **Workspace hierarchy rule:** The editor/output workbench must be the strongest visual object on first load; hero copy and decorative atmosphere may frame the product but never visually outweigh it.
- **Voice rule:** HORIZON copy reads like a senior engineer explaining evidence and scope—prefer mapping logic, detecting language, selecting functions, and generating reviewable documentation over broad AI-marketing claims.
- **Accent rule:** Horizon Blue `#75A7FF` is reserved for active navigation, primary actions, status signals, and key analysis states; violet appears only for the “Clarity” transformation or select analysis signals, never as general ambient glow.
