# Certificate system design QA

- Source visual truth: `C:\Users\garre\OneDrive\WORK\SYNERGY BAHAMAS\SB MARKETING\CERTIFICATES\2024\SB_Completion_Certificate.png`
- Browser implementation capture: `D:\CODEX\SynergyAcademy\tmp\design-qa\certificate-implementation-refined.png`
- Side-by-side comparison: `D:\CODEX\SynergyAcademy\tmp\design-qa\certificate-comparison-refined.png`
- Browser viewport: 1328 x 912 CSS pixels at device scale 1
- Source pixels: 3300 x 2550; normalized to 560 x 433 for comparison
- Implementation pixels: 560 x 433; certificate aspect ratio 11 x 8.5 landscape
- State: authenticated administrator, Certificate Template Studio, Design & Branding step, default Synergy Blue Completion template

## Full-view comparison evidence

The implementation preserves the visual guide's strongest brand cues: a white landscape field, substantial Synergy blue framing, a high-right Synergy Bahamas logo, bold uppercase credential heading, restrained navy/blue palette, and a blue lower rule. The source is a largely empty attendance template; the implementation intentionally uses the open field for live learner, course, skill, issue, signature, and verification data. The straight blue rail replaces the source's raster curved band so the default remains crisp at any browser or PDF size; administrators can upload an exact full-background design when needed.

## Focused-region comparison evidence

The certificate body and lower credential region were checked at the embedded 560 x 433 preview size. The final pass shows the learner and course hierarchy clearly, keeps the Synergy logo sharp, leaves the signature/date/verification row above the bottom band, and keeps the public-verification label and unique code legible. A focused region comparison was necessary because the first pass revealed lower-row crowding that was not obvious from the full admin screen.

## Required fidelity surfaces

- Fonts and typography: Montserrat remains the display face and Open Sans the supporting face. Container-relative sizing now scales with the certificate itself rather than the browser viewport. Heading, learner, course, metadata, and verification hierarchy are distinct at preview and PDF sizes.
- Spacing and layout rhythm: The content is centered in the source's open white field. The signature/date/verification row has reserved height and no longer collides with the bottom band.
- Colors and visual tokens: Synergy navy and blue match the application brand tokens and can be changed in the template editor. Contrast is sufficient on white and blue surfaces.
- Image quality and asset fidelity: The supplied Synergy Bahamas logo is used as a real raster asset. Uploaded background and alternate logo assets retain their source files through the certificate-assets bucket.
- Copy and content: Template wording is editable. The sample shows a realistic learner, course, skills, issue date, unique verification code, signature, and brand tagline.

## Comparison history

### Pass 1

- [P2] Signature and footer crowding at embedded preview size. Viewport-relative type sizes caused the certificate body to consume the lower credential row, placing signature text too close to the blue footer.
- Fix: converted certificate typography and icons to container-relative units, reduced internal vertical gaps, made the body shrink correctly, and reserved a fixed lower credential row.

### Pass 2

- Post-fix evidence: `certificate-comparison-refined.png` shows the signature, issue date, code, and public-verification label fully above the footer band.
- No actionable P0, P1, or P2 visual issues remain.

## Interaction and responsive checks

- Guided template wizard opens and advances from Basics to Design & Branding.
- Live certificate preview renders without browser console errors.
- Demo PDF generation completes in the browser.
- Public `/verify` page accepts and normalizes a code and presents a clear not-found state.
- Public verification was inspected at 390 x 844; the form, result surface, contact links, and branding remain within the viewport.
- The live database does not yet contain migration 015, so persisted template CRUD, automatic issuance, valid-code lookup, and email delivery require post-migration integration testing.

## Follow-up polish

- [P3] Exact curved certificate framing can be reproduced by uploading the user's full background artwork through the template editor when a fixed print-design match is preferred over the responsive default.

final result: passed
