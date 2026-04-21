# CWS Screenshots — Capture Checklist

Five screenshots required for the Chrome Web Store listing.

**Viewport:** 1280 × 800 px (required by CWS — set Chrome window to exactly this size before capturing).
**Format:** PNG (preferred) or JPEG.
**How to set viewport:** Open DevTools → toggle device toolbar → type 1280 × 800 in the dimensions fields, or resize the Chrome window to match.

---

## Setup Before Capturing

1. Load the unpacked extension: `chrome://extensions` → Enable "Developer mode" → "Load unpacked" → select `extension/dist/`.
2. Pin the Slant Detective icon to the toolbar (puzzle-piece menu → pin).
3. For screenshots 1, 2, 3 (Layer 2): have a valid Anthropic API key saved in the options page first.
4. For screenshot 4 (Layer 1): clear the API key from options, or use a fresh Chrome profile with no key.

---

## Recommended Article URLs

Use a long-form political or policy news article for best results. Good choices:
- https://www.nytimes.com/section/politics (pick any current article)
- https://www.foxnews.com/politics (pick any current article)
- https://www.theguardian.com/us-news (pick any current article)
- Any article ≥ 600 words will show full Layer 2 results.

Avoid: paywalled content the user cannot see, short wire-service blurbs (< 400 words), and video-primary pages.

---

## Screenshot 1 — Layer 2 full rubric

**What to show:** The side panel open on a real news article, showing:
- Overall intensity score and direction tilt (e.g., "7 / 10 · Left")
- Four-dimension breakdown (word choice, framing, headline slant, source mix) with scores
- At least 3–4 evidence rows visible in the Evidence section

**Steps:**
1. Navigate to a political article.
2. Click the Slant Detective toolbar icon.
3. Wait for Layer 2 analysis to complete (5–15 seconds with an API key).
4. Scroll the panel if needed so both the Overall section and at least the top of the Evidence list are visible.
5. Capture the full 1280 × 800 window (article + open side panel).

**Filename suggestion:** `screenshot-1-layer2-full-rubric.png`

---

## Screenshot 2 — Article page with inline highlights

**What to show:** The article body with dotted-underline highlights visible on loaded-language phrases. The side panel can be visible or minimized.

**Steps:**
1. After the Layer 2 analysis from Screenshot 1 completes, scroll the article page to a paragraph with multiple highlights visible.
2. The highlights appear as colored dotted underlines (red for loaded language, orange for framing, blue for source attribution).
3. Capture a section of the article where 3–6 highlights are clearly visible.
4. The side panel may be open alongside, showing the evidence list.

**Filename suggestion:** `screenshot-2-article-highlights.png`

---

## Screenshot 3 — Hover tooltip on a highlight

**What to show:** The hover tooltip floating over a highlighted phrase, showing the phrase text, category (e.g., "Loaded language"), severity, tilt direction, and one-sentence reason.

**Steps:**
1. From the highlighted article page, hover the mouse over a red (loaded-language) highlight.
2. Wait for the tooltip to fully render (shadow-DOM tooltip, publisher CSS cannot override it).
3. Capture the tooltip in context — the highlighted phrase visible, the tooltip box floating above it.
4. If using a screenshot tool that respects hover state, capture immediately. If using Cmd+Shift+4, hover first and use a delay-capture extension or the built-in macOS timer.

**Filename suggestion:** `screenshot-3-hover-tooltip.png`

---

## Screenshot 4 — Layer 1 panel (no API key)

**What to show:** The side panel open with Layer 1 results only — intensity bars, no overall score, no evidence reasons, and the "Add API key for full rubric" upsell row at the bottom.

**Steps:**
1. Open Chrome Options for Slant Detective and clear (or leave blank) the API key field.
2. Navigate to a news article.
3. Click the Slant Detective toolbar icon.
4. Layer 1 runs immediately (no network call). The panel shows: source badge, language-intensity bar, headline-drift bar, attribution-skew bar, and the loaded-words list.
5. Scroll the panel down so the "Add API key" upsell row is visible.
6. Capture the full 1280 × 800 window.

**Filename suggestion:** `screenshot-4-layer1-no-key.png`

---

## Screenshot 5 — Options page (API key input)

**What to show:** The extension options page with the API key field and the explanatory copy ("Your key stays in this browser...").

**Steps:**
1. Open the options page: right-click the Slant Detective toolbar icon → "Options," or navigate to `chrome://extensions` → Slant Detective → "Details" → "Extension options."
2. The options page opens in a new tab.
3. The key field should be empty (or show the masked placeholder `sk-ant-...`).
4. Capture the full 1280 × 800 window.

**Filename suggestion:** `screenshot-5-options-page.png`

---

## Upload to CWS

In the Chrome Web Store Developer Dashboard:
1. Go to https://chrome.google.com/webstore/devconsole
2. Select your extension → "Store listing" tab.
3. Scroll to "Screenshots" — upload all 5 PNG files.
4. CWS accepts 1–5 screenshots at 1280 × 800 or 640 × 400 (1280 × 800 displays better on high-DPI screens).
5. Set a descriptive alt text for each screenshot (accessibility requirement).
