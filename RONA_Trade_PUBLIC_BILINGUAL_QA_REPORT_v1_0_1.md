# RONA Trade + RONA Investments — Bilingual QA Report v1.0.1

## Status

CONTROL REVIEW / NOT DEPLOYED

Source package: `RONA_Trade_FULL_PUBLIC_BILINGUAL_CONTROL_CANDIDATE_v1_0_2026-08-11`

Correction pass: LANGUAGE SWITCH + SELECTIVE INVESTMENTS EN TRANSLATION v1.0.1

## Scope of changes

Only the two instructed corrections were applied:

1. persistent visible `RU | EN` styling restored on EN routed public pages;
2. RONA Investments MODE B pages reverted from EN image-text replacement overlays to the locked original USER ASSET graphic text, while normal DOM text remains translated to English.

No RU runtime HTML/CSS/JS/assets were changed.

## Language switch QA

Routed public page pairs checked: 16 pairs / 32 directed language states.

- RONA Trade pairs: Home Large, Home Compact, About, Products, Logistics, Supply Geography, Contacts.
- RONA Investments pairs: Entry, Home, About, Products, Strategy & Investments, Business / Projects / Data / Risk, Industries, How We Work, Client Value.

Results:

- SWITCHER AVAILABLE ON RU PAGES = PASS (DOM + CSS static audit)
- SWITCHER AVAILABLE ON EN PAGES = PASS (DOM + CSS static audit)
- RU → EN → RU ROUNDTRIP TARGETS = PASS (32/32)
- PAGE-TO-PAGE LANGUAGE PAIRING = PASS
- WRONG LANGUAGE ROUTES = 0
- SWITCHER MISSING PAGES = 0
- EN RONA Trade switcher style definitions restored = 7/7
- EN RONA Investments switcher style definitions restored = 9/9
- Desktop fixed-position rule present = PASS
- Mobile `<768px` visibility rule present = PASS

The switcher uses the exact counterpart of the current page and does not force Home navigation.

## RONA Trade EN

- RONA TRADE FULL EN = PASS (existing v1.0 EN content preserved)
- Existing RU/EN route architecture preserved.
- Existing RONA Trade form behavior preserved.
- Existing legal / registered entity names and official operator names that remain in source-language form are not treated as untranslated UI.

## RONA Investments translation matrix

| Page / UI | Mode | DOM text EN | Graphic text unchanged | EN replacement mask |
|---|---|---:|---:|---:|
| Home | FULL | PASS | USER ASSET unchanged | Allowed only as existing Home behavior |
| Consultation panel/form | FULL | PASS | N/A | N/A |
| About | FULL | PASS | USER ASSETS unchanged | NO |
| Products | TEXT-ONLY | PASS | PASS | NO |
| Strategy & Investments | TEXT-ONLY | PASS | PASS | NO |
| Business / Projects / Data / Risk | TEXT-ONLY | PASS | PASS | NO |
| Industries | TEXT-ONLY | PASS | PASS | NO |
| How We Work | TEXT-ONLY | PASS | PASS | NO |
| Client Value | TEXT-ONLY | PASS | PASS | NO |

Dedicated image-text replacement layers removed from MODE B:

- `en-prod-overlays` = 0
- `en-ind-overlays` = 0
- `en-hw-overlays` = 0
- `en-cv-overlays` = 0
- corresponding `ri-en-*-image-text-*` style blocks = 0

MODE B visible DOM Cyrillic = 0 on all six pages. Russian text physically embedded in the approved graphical USER ASSETS is intentionally preserved.

## FULL EN checks — Investments

- INVESTMENTS HOME FULL EN = PASS (static content audit)
- INVESTMENTS CONSULTATION FULL EN = PASS (title, labels, placeholders, select options, consent, submit, status/success/error strings retained in EN)
- Consultation recipient = `rokotove26@gmail.com` (unchanged)
- `Language: EN` payload support preserved
- INVESTMENTS ABOUT FULL EN = PASS
- Cyrillic strings remaining in About are registered/source entity names `ПАО «Газпромнефть»` and `НИС Газпромнефть`, preserved intentionally rather than inventing official English legal names.

## RU integrity / USER ASSET lock

- RU runtime files checked against v1.0 source = 37
- RU runtime byte changes = 0
- RU CONTENT REGRESSION = 0
- RU DESIGN REGRESSION = 0 by byte-level runtime preservation
- RU FUNCTION REGRESSION = 0 by byte-level runtime preservation
- USER ASSET MODIFICATIONS = 0
- NEW IMAGES = 0
- EDITED IMAGES = 0

For all 9 Investments RU/EN page pairs, embedded `data:image` payload hashes are identical page-for-page.

## Routes / assets / code

- BROKEN LOCAL LINKS = 0
- ABSOLUTE INTERNAL LINKS = 0
- MISSING LANGUAGE PAIRS = 0
- WRONG-LANGUAGE ROUTES = 0
- MISSING ASSETS = 0
- JavaScript syntax audit = 112 script blocks / 0 syntax errors
- Unnecessary duplicate file hashes = 0

## Browser visual QA limitation

A real Chromium visual pass was attempted in the current agent environment. Chromium did not complete initialization and timed out with infrastructure D-Bus / browser-process errors.

Therefore:

- REAL DESKTOP BROWSER VISUAL MATRIX = NOT EXECUTED
- REAL MOBILE BROWSER VISUAL MATRIX = NOT EXECUTED
- EXTERNAL VISUAL CONTROL REQUIRED = YES

No intercepted or simulated browser result is reported as runtime PASS.

Static DOM/CSS route, switcher, translation-mode, asset-hash and dependency audits are PASS.

## Packaging

Final package requirements checked after assembly and clean extraction:

- unexpected files = 0
- old QA report = removed
- WIP / backup / nested ZIP / screenshots / debug / temp = 0
- clean extraction = PASS
- SHA256 verification = PASS

## Required summary

```text
SWITCHER AVAILABLE ON RU PAGES = PASS (STATIC DOM/CSS)
SWITCHER AVAILABLE ON EN PAGES = PASS (STATIC DOM/CSS)
RU → EN → RU ROUNDTRIP = PASS (STATIC TARGET AUDIT)
PAGE-TO-PAGE LANGUAGE PAIRING = PASS
WRONG LANGUAGE ROUTES = 0

RONA TRADE FULL EN = PASS

INVESTMENTS HOME FULL EN = PASS
INVESTMENTS CONSULTATION FULL EN = PASS
INVESTMENTS ABOUT FULL EN = PASS

INVESTMENTS MODE-B DOM TEXT EN = PASS
INVESTMENTS MODE-B GRAPHIC TEXT PRESERVED = PASS
INVESTMENTS MODE-B EN MASKS = 0

RU REGRESSION = 0
USER ASSET MODIFICATIONS = 0
BROKEN LINKS = 0
MISSING ASSETS = 0
SHA256 = PASS
DEPLOYMENT = NOT PERFORMED

REAL BROWSER VISUAL QA = EXTERNAL CONTROL REQUIRED
```
