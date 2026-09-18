---
name: Synergy Academy
description: A clear, professional learning workspace grounded in the Synergy Bahamas identity.
colors:
  synergy-navy: "#10263f"
  academy-blue: "#115ba5"
  academy-blue-deep: "#124d84"
  progress-blue: "#126bbe"
  warm-gold: "#ffc107"
  paper: "#f8fafc"
  platform-canvas: "#e7eff7"
  companion-canvas: "#f4f7fb"
  surface: "#ffffff"
  ink: "#0f172a"
  ink-muted: "#64748b"
  ink-support: "#334155"
  line: "#e2e8f0"
  panel-line: "#dce4ee"
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
  companion-headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  companion-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 650
    lineHeight: 1.4
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
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.academy-blue-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-support}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "20px"
  companion-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "24px"
  companion-continue:
    backgroundColor: "{colors.synergy-navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "32px"
---

# Design System: Synergy Academy

## Overview

**Creative North Star: "The Guided Academy"**

Synergy Academy is a calm, structured adult-learning workspace. It uses Synergy Bahamas navy as the institutional anchor, blue for action and orientation, and warm gold sparingly as a brand signal. The interface is information-dense enough for academic operations while keeping each task legible and approachable.

The visual world is polished and direct rather than decorative. Real Synergy Bahamas logo assets establish identity; Lucide icons support scanning; generous white surfaces keep curriculum and academic records easy to read.

The Course Delivery Companion extends the approved September refinement. It retains the native system sans and navy, blue, white, and warm-gold identity, with a plain cool canvas and white reading panels. Its strongest visual emphasis is the next module action; component content has a dedicated destination rather than expanding inside the module checklist.

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
- **Platform Canvas / Companion Canvas:** The platform's cool background and the companion's plain reading canvas are distinct surface roles. Companion routes suppress the inherited background decoration.
- **Surface:** Cards, forms, navigation, and reading areas.
- **Ink / Ink Muted:** Primary and supporting copy.
- **Line:** Dividers, field strokes, and quiet boundaries.
- **Panel Line:** Companion panel and tab boundaries.

Calendar and announcement surfaces retain the platform's warm-paper and pale-sage grouping treatments. These tones group information; explicit labels and icons communicate state.

**The Blue Means Action Rule.** Blue identifies something interactive, selected, or in focus; it does not wash entire content areas without purpose.

## Typography

**Display Font:** Native system sans (SF on Apple, Segoe UI on Windows, Roboto on Android)
**Body Font:** The same system sans, compact interface copy and larger reading text

**Character:** Crisp native typography keeps dense academic and administrative copy professional and predictable across devices. Headings retain a larger, semibold hierarchy.

### Hierarchy

- **Display:** Bold and tightly tracked for the sign-in statement and rare feature headings.
- **Headline:** Bold 24px page and authentication headings.
- **Title:** Semibold 16px section and card titles.
- **Body:** Regular 13px shared interface copy, 14px companion captions, and existing larger lesson-reading sizes. Reading passages use open line spacing and constrained measure.
- **Label:** Semibold compact form and control labels; uppercase 12px is reserved for functional navigation groups.
- **Companion headline / title:** Responsive 24–32px page headings and 19.2px section headings, both at weight 650; the next-module heading is larger than ordinary section titles.

**The One-Family Hierarchy Rule.** Use size, weight, and spacing for hierarchy. Mobile form controls remain at least 16px to avoid automatic input zoom. The native system family is an explicitly approved incumbent identity decision.

## Layout

Authenticated screens use a fixed 240px desktop sidebar and a centered content region capped at 1400px. Content spacing follows a 4/8/16/24/32px rhythm, with 20px as the common card inset. Forms collapse from two or three columns to one, tables scroll horizontally, and the sidebar becomes a dismissible mobile drawer below the 1024px breakpoint. The sign-in screen uses a brand panel and form panel on large screens, then removes the brand panel and places the full-color logo inside the form on mobile.

Companion content is capped at 1120px. Overview content uses a 1.5:1 main/supporting grid with 24px gaps. At 700px and below, that grid, the next-module panel, and staff forms become single-column; ordinary companion panels reduce to 18px padding and the main continuation control fills the available width. Recap panels use responsive 20–48px insets, and their action row stays available at the bottom on small screens. Course-section navigation scrolls horizontally without changing its destinations. Top bars remain 64px and temporary menus render above page content.

## Elevation & Depth

Depth is ambient and restrained. White surfaces separate primarily through background tone; soft multi-layer shadows distinguish interactive or grouped content without hard offsets.

Companion reading and overview panels are flat, using a quiet border on the plain canvas. Their static surfaces do not lift on hover. The navy continuation panel establishes hierarchy through tone and scale.

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

### Course Delivery Companion

- **Orientation:** Overview, Modules, Live Classes, and Resources use labeled course-section tabs. Component pages show a Back to module action plus the module name and required-item completion count.
- **Next action:** The navy continuation panel gives Continue Module the dominant action, changing to View Modules when no next released work is outstanding.
- **Module checklist:** Rows show each component's title, required/optional label, text status with a Lucide icon, and a destination. The checklist contains navigation and status, not embedded component content.
- **Dedicated destinations:** eBook recap, video, audio, resources, activity, assessment, and live class each open independently. Recaps use white reading panels, page position, previous/next actions, and source attribution after the content as a footer rather than an eyebrow.
- **Progress:** Native blue progress bars have accessible names and adjacent counts. Completed, in-progress, and not-started states retain text labels. Locked modules retain readable release information.
- **Media:** Video uses a 16:9 stage. Audio uses a light player surface and native controls. Supporting playback-speed and completion controls retain visible labels.
- **Interaction:** Buttons, selects, and text inputs have a 44px minimum height. Checklist links provide generous row targets; focus on companion links and buttons uses a two-pixel blue outline with a three-pixel offset.

### Buttons

- **Shape:** 8px radius with compact 8px by 16px padding and a 44px minimum target.
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

Mobile navigation excludes the background from keyboard interaction, traps Tab within the drawer, and closes with Escape. Course resource file tiles preserve blue and warm-gold category cues; messages retain wrapping segmented navigation and readable announcements. Readiness warnings keep an explicit issue count and expandable detail; collapsing detail never implies readiness. Reduced motion and tabular numerals remain shared requirements.

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
