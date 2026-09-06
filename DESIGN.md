---
name: Synergy Academy
description: A clear, professional learning workspace grounded in the Synergy Bahamas identity.
colors:
  synergy-navy: "#0a1628"
  academy-blue: "#1c7bf5"
  academy-blue-deep: "#1463e0"
  warm-gold: "#ffc107"
  paper: "#f8fafc"
  surface: "#ffffff"
  ink: "#0f172a"
  ink-muted: "#64748b"
  line: "#e2e8f0"
  success: "#16a34a"
  warning: "#ea580c"
  danger: "#dc2626"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  control: "8px"
  surface: "12px"
  feature: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.academy-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.academy-blue-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "20px"
---

# Design System: Synergy Academy

## Overview

**Creative North Star: "The Guided Academy"**

Synergy Academy is a calm, structured adult-learning workspace. It uses Synergy Bahamas navy as the institutional anchor, blue for action and orientation, and warm gold sparingly as a brand signal. The interface is information-dense enough for academic operations while keeping each task legible and approachable.

The visual world is polished and direct rather than decorative. Real Synergy Bahamas logo assets establish identity; Lucide icons support scanning; generous white surfaces keep curriculum and academic records easy to read.

**Key Characteristics:**

- Strong navy-and-white brand framing
- Blue reserved for navigation, focus, and primary action
- Compact operational typography with clear hierarchy
- Soft ambient depth and consistently rounded surfaces
- Responsive navigation that preserves the same information architecture

## Colors

The palette combines institutional navy, clear action blue, and cool neutral surfaces, with gold used only for small brand accents.

### Primary

- **Synergy Navy:** Brand framing, dark feature surfaces, and high-authority headings.
- **Academy Blue:** Primary actions, active navigation, links, and focus states.

### Secondary

- **Warm Gold:** Small identity accents and selected attention markers, never a competing action color.

### Neutral

- **Paper:** Application background and quiet grouped regions.
- **Surface:** Cards, forms, navigation, and reading areas.
- **Ink / Ink Muted:** Primary and supporting copy.
- **Line:** Dividers, field strokes, and quiet boundaries.

**The Blue Means Action Rule.** Blue identifies something interactive, selected, or in focus; it does not wash entire content areas without purpose.

## Typography

**Display Font:** Native system sans (SF on Apple, Segoe UI on Windows, Roboto on Android)
**Body Font:** The same system sans, 13px interface copy and 14px lesson body copy

**Character:** Crisp native typography keeps dense academic and administrative copy professional and predictable across devices. Headings retain a larger, semibold hierarchy.

### Hierarchy

- **Display:** Bold and tightly tracked for the sign-in statement and rare feature headings.
- **Headline:** Bold 24px page and authentication headings.
- **Title:** Semibold 16px section and card titles.
- **Body:** Regular 14px interface copy, increasing to 16px only for longer reading passages.
- **Label:** Semibold 14px form and control labels; uppercase 12px is reserved for functional navigation groups.

**One-family hierarchy.** Use size, weight, and spacing for hierarchy. Mobile form controls remain at least 16px to avoid automatic input zoom.

## Layout

Authenticated screens use a fixed 240px desktop sidebar and a centered content region capped at 1400px. Content spacing follows a 4/8/16/24/32px rhythm, with 20px as the common card inset. Forms collapse from two or three columns to one, tables scroll horizontally, and the sidebar becomes a dismissible mobile drawer below the 1024px breakpoint. The sign-in screen uses a brand panel and form panel on large screens, then removes the brand panel and places the full-color logo inside the form on mobile.

## Elevation & Depth

Depth is ambient and restrained. White surfaces separate primarily through background tone; soft multi-layer shadows distinguish interactive or grouped content without hard offsets.

### Shadow Vocabulary

- **Soft:** Low cards and panels at rest.
- **Card:** Hoverable navigation cards and higher-priority grouped content.
- **Elevated:** Menus, mobile drawers, and temporary layers.

**The Tonal-First Rule.** Use background contrast before adding elevation; a surface does not need both a prominent border and a prominent shadow.

## Shapes

Controls use gently curved 8px corners, standard surfaces use 12px corners, and only large authentication or feature panels use 16px corners. Pills belong to compact statuses and badges. Circular shapes are reserved for avatars, unread markers, and small identity accents.

## Components

### Lesson player

- **Course orientation:** A persistent outline drawer shows every published module and lesson with completed, current, available, and locked states.
- **Content parts:** One lesson part may contain multiple ordered blocks. Stacked is the default; split layout places image or video media beside text on wider screens and collapses to one column on mobile.
- **Navigation:** A persistent contextual bar moves backward or forward through parts first, then through lessons, without presenting two competing navigation systems.

### Buttons

- **Shape:** 8px radius with compact 10px by 16px padding.
- **Primary:** Academy blue, white text, medium weight, and soft depth.
- **Hover / Focus:** Darker blue on hover and a visible two-pixel palette-matched focus ring.
- **Secondary / Ghost:** White bordered or transparent neutral actions, reserving filled blue for the main task.

### Chips

- **Style:** Small rounded status pills with tonal backgrounds and semantic text colors.
- **State:** Success, warning, danger, brand, and neutral variants carry status without replacing labels.

### Cards / Containers

- **Corner Style:** 12px standard radius.
- **Background:** White on cool paper.
- **Shadow Strategy:** Soft by default; elevated only for interactive emphasis.
- **Border:** Optional low-contrast line, never paired with a heavy shadow.
- **Internal Padding:** Usually 20px, rising to 24px for feature areas.

### Inputs / Fields

- **Style:** White field, quiet neutral stroke, 8px corners, and persistent text label.
- **Focus:** Blue border and translucent blue ring.
- **Error / Disabled:** Semantic red alert copy; reduced opacity and unavailable cursor for disabled actions.

### Navigation

Desktop navigation uses Lucide icons with compact text labels on a solid navy surface. Active destinations use a translucent white field and higher-contrast text. Mobile retains the same sections in a focus-contained overlay drawer with a persistent academy header.

## Platform refinement — September 2026

The Synergy identity remains authoritative. The September 5 user-approved refinement replaces Montserrat/Open Sans with crisp native system typography, retaining navy, blue, warm gold, and readable tonal surfaces.

- Canvas `#edf2f7`, sidebar `#10263f`, white task surfaces, and dividers `#dce4ee` separate navigation, orientation and working content.
- Calendar summaries use warm paper `#f8f5ed` with `#e8e0cd` borders; announcements use pale sage `#eff6f4` with `#d8e7e3` borders. These tones group information, not performance or success states; explicit labels and icons remain mandatory.
- Primary controls use the established brand-700 token, solid white text and a 44px minimum target. Secondary controls are white with a quiet stroke. Static cards must not lift on hover as though clickable.
- Page headings use 24px, the dashboard greeting 30px on desktop, body 14px, and metadata 12px. Course-reading content keeps its existing larger reading sizes.
- Course module cards use compact identity/status strips, one topic title, duration and score, progress, and one destination. Locked cards keep readable text rather than reducing the opacity of the whole card.
- Course resources use reusable file tiles; homework and capstone tiles retain blue and warm-gold category cues. Messages uses a wrapping segmented navigation control and full readable announcements.
- Top bars are 64px. Desktop sidebars remain 240px; all temporary menus render above page content. Mobile navigation excludes the background from keyboard interaction, traps Tab within the drawer, and closes with Escape.
- Readiness warnings show an explicit issue count and expandable detail. Collapsing detail never implies the course is ready.
- Native progress controls use the existing `#126bbe` academy blue and fully rounded tracks. Keyboard focus, reduced motion and tabular numerals are part of the shared system.

## Do's and Don'ts

### Do:

- **Do** use the supplied full logo assets wherever a full brand signature is appropriate.
- **Do** keep one obvious primary action per form or operational panel.
- **Do** provide loading, empty, error, disabled, hover, and keyboard-focus states.
- **Do** use tabular numerals for changing counts, grades, and percentages.

### Don't:

- **Don't** introduce unrelated gradients, glass effects, hard-offset shadows, or decorative texture.
- **Don't** replace Lucide icons with emoji or platform glyphs.
- **Don't** use warm gold as a general call-to-action color.
- **Don't** expose academic data in decorative or public-facing components.
