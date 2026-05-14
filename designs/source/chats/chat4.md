# Brand Guidelines Portal

_Started 2026-05-14 19:39 UTC_

---

## User

can you make one branding html that has all the colors and brand guidelines and everything

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: update_todos]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Built **Brand Guidelines.html** — a single scrollable brand book for Arham Always Care, drawn entirely from the IPD app's existing system (no invented identity from outside).

It covers:
1. **Brand essence** — mission, three principles, brand promise
2. **Logo** — primary mark (paw-in-chassis), reversed, app icon, mark-only sizes, clearspace, four "don'ts"
3. **Color** — Arham Teal scale, the three surface themes (Clinical / Warm / Utility) from `shell.jsx`, and Critical / Stable / Observation status pills with light + dark pairs
4. **Type** — Plus Jakarta Sans + Inter specimens at 8 sizes with leading and tracking specs
5. **Iconography** — 16 line icons on a 24-px grid with stroke + cap rules
6. **Components** — buttons, chips, status pills, patient cards, spacing scale, radius scale
7. **Imagery** — placeholders for the photo/xray/video/doc media kinds, with do/don't
8. **Voice** — good/bad copy pairs for round notes, empty states, and alerts, plus glossary
9. **Accessibility** — contrast, target size, motion, status redundancy

Let me know what to push further — e.g. a downloadable PDF version, more logo lockups, or expand the component library.

## User

so basically this is not going to be a mobile app, its a web app so will be opening in a browser. keeping this in mind redesign stuff get rid of notch and things, etc.

## User

so basically this is not going to be a mobile app, its a web app so will be opening in a browser. keeping this in mind redesign stuff get rid of notch and things, etc.

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Got it. Switching from a mobile shell to a proper desktop web layout. I'll:

1. Replace the iOS device frame with a left sidebar + top bar layout (full viewport)
2. Swap bottom nav for side nav, drop the FAB (primary action moves into the top bar)
3. Update Brand Guidelines to reflect web surfaces (no app icon, add favicon + sidebar guidance instead)

Let me build a new web shell, rewire the app, and refresh the brand book.

_[tool: grep]_

Now I have enough context. Let me read the ActivitySheet and then build everything.

_[tool: read_file]_

_[tool: grep]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now I'll build the web shell, rewire the app, and update the brand guidelines for web context.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now fix the sheets (bottom sheets → modal/drawer), make Header non-sticky, and reposition the toast.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

Now update WebShell padding to give content room and refresh the Brand Guidelines for web context.

_[tool: fork_verifier_agent]_

Clean load. Let me have the verifier do a quick visual sweep on the app and brand guidelines.Rewired from mobile to web. The full set of changes:

**App shell** (`index.html`, `app.jsx`, new `web-shell.jsx`)
- Dropped the iOS device frame, status bar, dynamic island, home indicator
- Added a 232 px left sidebar — brand mark, "New entry" primary action (also `N` keyboard shortcut), nav items with patient count badge, user/role footer
- Added a 56 px sticky top bar — breadcrumb with click-back, search input with ⌘K hint, notifications bell
- Bottom nav and FAB removed
- Content area max-width 1040 px, centered

**Sheets** (`shell.jsx`, `activity-detail.jsx`)
- `AddSheet` and `RoleSheet` → centered modals with close buttons
- `ActivitySheet` → right-side drawer (slides in from edge)
- Undo toast → centered at bottom of viewport instead of hugging the kennel-bottom

**Other**
- `Header` (per-screen page title) is no longer sticky and no longer doubles as a nav — TopBar handles nav
- Dashboard's role badge removed (now lives in sidebar footer)

**Brand Guidelines** (`Brand Guidelines.html`)
- Surfaces: Web · desktop & tablet
- Logo board: app icon tile → favicon (16/32/64) + sidebar lockup tile
- Components: rewritten around sidebar/topbar; target sizes adjusted for web (32 min icon, 40 primary)
- Accessibility: density check rewritten for 1280×800 laptops

**Files left in place but unused**: `ios-frame.jsx` is no longer loaded by `index.html` — kept on disk in case you ever want a mobile companion view. Say the word and I'll delete it.

What to push on next: making individual screens use the width (Dashboard stats grid as 4 columns instead of 2, Patients as a real table, etc.) — say "lay out the screens for desktop" and I'll go through each.

## User

Verifier agent check completed

## Assistant

Verifier confirmed the layout is clean. Ready for the next move — say the word on:

- **"Lay out the screens for desktop"** — Dashboard stats as 4 columns, Patients as a real table, Activity feed using the width
- **"Wider"** / **"Narrower"** — tweak the content max-width
- **"Drop the iOS files"** — clean up `ios-frame.jsx`
- Anything else in the brand book

## User

bruh what about the phone view? we need it just like you had made the previous ios version

## Assistant

_[tool: read_file]_

_[tool: read_file]_

Got it — you want both. Let me preserve the iOS phone view alongside the web one, with a small toggle to flip between them.

_[tool: str_replace_edit]_

## User

dont give me a toggle, make a new html seprate for the phone view I will download both and hand over to claude code

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Good plan. I'll keep them as two separate self-contained HTMLs that share the same screen code via a `window.UI_MODE` flag. Each one stands alone for handoff.

_[tool: str_replace_edit]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: done]_

_[tool: read_file]_

I broke the return structure. Let me read and fix.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. You now have two standalone HTMLs to hand off:

- **`index.html`** — desktop web app (sidebar + top bar, no device frame)
- **`Mobile.html`** — iOS phone view (device frame, bottom nav, FAB, dynamic island)

Both share the same screens, data, sheets, and brand system. The only difference is the entry point — set by `window.UI_MODE` at the top of each HTML. Header, AddSheet, RoleSheet, ActivitySheet and UndoToast all branch on that flag so each version looks native to its surface.

For Claude Code, the file map:
- Shared: `data.js`, `icons.jsx`, `shell.jsx`, `screens-main.jsx`, `screens-forms.jsx`, `activity-detail.jsx`, `media.jsx`, `tweaks-panel.jsx`
- Web only: `web-shell.jsx`, `app.jsx`
- Mobile only: `ios-frame.jsx`, `app-mobile.jsx`
- Brand: `Brand Guidelines.html`

Verifier is sweeping both — will wake me if anything's broken.

## User

Verifier agent check completed

## Assistant

Both views clean. Ready for handoff — `index.html` and `Mobile.html` are the two entry points; everything else is shared code or design reference.

## User

bro wtf its not an app, make a webview in mobile thing remove that notch and stuff what are you doing again and again tf

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

You're right — sorry for the misread. "Webview in mobile" = the *same web app*, just shown inside a phone-shaped browser frame. Not an iOS-native app. Let me strip out the mobile-as-iOS code and make the web app responsive, then put it in a clean phone+browser frame.

_[tool: grep]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me rewrite the web shell as responsive (sidebar collapses at narrow widths) and rebuild Mobile.html as an iframe-based phone preview.

_[tool: write_file]_

_[tool: delete_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Fixed. Mobile.html is now what you actually asked for:

- **Phone-shaped frame** (rounded rectangle, no notch, no dynamic island, no home indicator)
- **Safari-style browser chrome** at top with URL bar showing `arham.app/ipd` + reload + menu
- **Bottom browser bar** (back/forward/share/bookmarks/tabs)
- **iframe loads `index.html`** at phone width

The web app inside automatically goes responsive at < 760px:
- Sidebar collapses, hamburger menu appears in the top bar
- Brand mark + current section name shown next to it
- Search input shrinks to an icon button
- Primary `+` button moves into the top bar

So both files are the same web app — Mobile.html is just it embedded in a phone-browser preview. `app-mobile.jsx` and the iOS device frame stuff are no longer used (`ios-frame.jsx` left on disk; can delete if you want).

Verifier is checking both. Will wake me if anything's wrong.

## User

yo where did that strip go? the bottom strip with + symbol and all bro dont be ridicuslous, stop showing me stupid frames just design a mobile view I dont even want an html just design okay? no frames of any kind like ios - browser what so ever.

## Assistant

_[tool: grep]_

Got it. Restoring the mobile design — bottom strip with +, sticky header, bottom sheets — and getting rid of all the frame nonsense. Mobile.html will just be the IPD app designed for mobile, full viewport, no chrome.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. Mobile.html is now what you asked for:

- **No frame at all** — no phone bezel, no iOS notch, no browser chrome
- **Full viewport** — the app fills the whole screen
- **Bottom nav strip is back** — Today / Patients / **+ FAB** / Reports / Docs
- **Sticky page header** at top, **bottom sheets** for Add and Role, full-screen drawer for activity detail
- **Mobile-tuned styling** — smaller padding, larger touch targets, mobile-friendly type

It's the IPD app, designed for mobile, rendered at whatever viewport size you give it (looks correct on a phone; on a big desktop it'll just stretch — that's by design since you said no frames).

Two clean files for Claude Code:
- **`index.html`** — desktop / web (sidebar + topbar, responsive)
- **`Mobile.html`** — mobile-styled (bottom nav, sticky header, bottom sheets)

Shared code: `data.js`, `icons.jsx`, `shell.jsx`, `media.jsx`, `screens-main.jsx`, `screens-forms.jsx`, `activity-detail.jsx`, `tweaks-panel.jsx`. The `Header`, `AddSheet`, `RoleSheet`, `ActivitySheet`, and `UndoToast` components branch on `window.UI_MODE` so the same screens look right in both. Web-only: `web-shell.jsx`, `app.jsx`. Mobile-only: `app-mobile.jsx`.

Verifier is checking. Will flag anything broken.

## User

Verifier agent check completed

## Assistant

All clean. Both files ready for handoff to Claude Code.

