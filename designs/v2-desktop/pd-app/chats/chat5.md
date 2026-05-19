# Desktop layout additions

_Started 2026-05-18 05:12 UTC_

---

## User

and we also need the desktop layout equivalent to the new mobile layout additions that we have done.

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

I need to see what new mobile additions exist. Let me check the screens and shell files:

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

I want to make sure I'm porting the right thing. Looking at the codebase, the screen components are already shared between mobile (`Mobile.html` → `app-mobile.jsx`) and desktop (`index.html` → `app.jsx`) — the only mobile-specific code is the shell furniture (BottomNav, AddSheet bottom-sheet variant, sticky mobile Header in `shell.jsx`), and the desktop shell (`web-shell.jsx`) already wraps the same screens with sidebar + top bar.

Could you point me at the "new mobile layout additions" you're referring to? A few possibilities I want to confirm:

1. **A specific screen** you recently added/modified on mobile (e.g. a new dashboard widget, a new flow, a redesign of the patient detail page) that needs a desktop counterpart?
2. **A new shell affordance** on mobile (e.g. a new sheet, a new nav item, a new gesture) that should be reflected in `web-shell.jsx`?
3. **Mobile.html as a file**'s recent reorganization (since it's currently using shared screen files, anything inside those is automatically on desktop)?

If you can tell me which file(s) you edited recently or describe the change in 1-2 sentences, I'll port it cleanly to the desktop layout. Otherwise I risk recreating something that's already there.

## User

so I edited mobile.html to add images and all things those things needs to be updated in the desktop view

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: show_html]_

Let me compare the two views side by side to see what's different. Looking at the file includes, both `index.html` and `Mobile.html` already include the same shared scripts (`media.jsx`, `activity-detail.jsx`, all screens), so images should already render in both. Let me verify:

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: read_file]_

Both views already render with the image/photo system in place. Let me look more carefully at the rest of the codebase for any mobile-specific image handling I might have missed:

_[tool: grep]_

_[tool: list_files]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: grep]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: grep]_

I want to make sure I solve the right problem. Looking at the codebase carefully:

- Mobile.html and index.html both already load the same shared files (`media.jsx`, `activity-detail.jsx`, all screens).
- The Photo placeholders, MediaStrip on activity cards, lightbox, and admission upload grids all show up identically on both views.

What I'm seeing on desktop right now is a **narrow column** layout (1040px max, single column, same as mobile but with a sidebar around it). That's probably not a true "desktop layout."

Could you tell me which one you mean by "the new mobile layout additions"? A few likely interpretations:

1. **The activity timeline with photo thumbnails as timeline nodes** (the `+1`/`+2` overlays I see on mobile) — already in shared code, should already show on desktop.
2. **A photo hero/gallery at the top of the animal detail page** — there's a `HeroBanner` component in `media.jsx` that isn't being used anywhere. Did you intend that to render at the top of the Bruno page?
3. **The desktop should actually use the horizontal space** — instead of a narrow center column, show a true two-column desktop layout (e.g. patient summary + hero photo on the left, activity feed on the right, photo grid for documents).
4. **A specific screen** you tweaked (which one?) where the mobile version now has something desktop doesn't.

If you can drop a screenshot of the mobile view you're happy with, or just say "do option 3" or name the screen, I'll port it cleanly. Right now I don't want to guess and rebuild things that already render correctly.

## User

wtf bro it is in mobile.html

## Assistant

_[tool: run_script]_

_[tool: show_html]_

I see it now — `index-bundle-src.html` (the file you're viewing) is out of date. It's missing the script imports that Mobile.html has. Let me sync it.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: get_webview_logs]_

_[tool: write_file]_

Found it. `index-bundle-src.html` is missing the imports that Mobile.html has. Let me sync it:

_[tool: done]_

Synced `index-bundle-src.html` with the same imports Mobile.html has:

- Added `media.jsx` (Photo placeholders, HeroBanner, MediaStrip, MediaGrid, Lightbox, `useLightbox`)
- Added `activity-detail.jsx` (ActivitySheet drawer, UndoToast)
- Added `web-shell.jsx` (desktop sidebar + topbar — needed because `app.jsx` references `<WebShell>`)
- Set `window.UI_MODE = 'web'` so shared shell primitives render their desktop variants
- Added the missing CSS keyframes (`slideRight`, `slideInLeft`, `modalIn`, `fadeIn`) that the modals/drawers depend on
- Removed the legacy `ios-frame.jsx` import (no longer needed for the desktop entry)

Page now loads with no console errors. The desktop layout will render the same Photo placeholders on avatars, activity timeline thumbs with `+N` badges, document grids, lightbox, and activity detail drawer that Mobile.html shows.

_[tool: fork_verifier_agent]_

Done — `index-bundle-src.html` now loads `media.jsx`, `activity-detail.jsx`, and `web-shell.jsx` to match what `Mobile.html` already had, plus the CSS keyframes those components animate against.

## User

now remove those show tweaks thing, I want clinical, by day and compact.

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: done]_

Done. Both apps now have the Tweaks panel removed entirely and ship with `theme: clinical`, `feedStyle: grouped` (By day), `density: compact` baked in as the defaults.

