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
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Open Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
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

**Display Font:** Montserrat (with system sans fallbacks)
**Body Font:** Open Sans (with system sans fallbacks)

**Character:** Montserrat gives headings a confident geometric structure while Open Sans keeps dense academic and administrative copy neutral and readable.

### Hierarchy

- **Display:** Bold and tightly tracked for the sign-in statement and rare feature headings.
- **Headline:** Bold 24px page and authentication headings.
- **Title:** Semibold 16px section and card titles.
- **Body:** Regular 14px interface copy, increasing to 16px only for longer reading passages.
- **Label:** Semibold 14px form and control labels; uppercase 12px is reserved for functional navigation groups.

**The Two-Family Rule.** Montserrat carries identity and hierarchy; Open Sans carries instructions, data, and extended reading.

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

Desktop navigation uses Lucide icons with compact text labels in a controlled navy-to-blue brand gradient. Active destinations use a translucent white field, higher-contrast text, and a slim inset marker. Mobile retains the same sections in an overlay drawer with a persistent academy header.

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
