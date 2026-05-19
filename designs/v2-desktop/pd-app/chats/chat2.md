# Activity Details Expansion

_Started 2026-05-14 08:29 UTC_

---

## User

hey so we need a more thoughtful UX here, there needs to be features where things can be edited, and stuff. so what all things we can do here to make that happen? 

and when we click on any activity it should expand or popup to show more details about it.

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: update_todos]_

Good — I have full context. Let me lay out a plan and start building.

**What I'll add** (more thoughtful editing UX):

1. **Tap any activity → bottom-sheet with full details** — shows every field (meds, vitals, findings, etc.) nicely formatted, plus actions: **Edit · Duplicate · Delete**.
2. **Inline-editable activity** — the sheet flips into edit mode using the same form components, so any field can be corrected without leaving context.
3. **Editable Animal "Details" tab** — tap any KV row to edit it inline; long values get a textarea. Includes a header "Edit" toggle.
4. **Editable status / ward / flags** on the hero card (tap pill → quick picker).
5. **Edit document name & category** from the docs list (small action menu).
6. **Audit trail** — every edit appends "edited by …" timestamp shown in the activity sheet.
7. **Soft-delete with undo toast** — deletes are reversible for 5s.

Let me build it in small chunks.

_[tool: str_replace_edit]_

_[tool: write_file]_

Now the activity detail sheet — the centerpiece. It needs to render every field per activity type beautifully, and flip into an edit mode.

_[tool: grep]_

_[tool: read_file]_

Good — `Edit`, `Trash`, `Close`, `Check` all exist. I just need a `Copy` icon.

_[tool: str_replace_edit]_

Now wire activity taps in `screens-main.jsx`. I need to make `ActivityCard` clickable, make timeline cards clickable, and pass an `onOpen` callback down from `AnimalDetailScreen`. I'll also add the sheet itself there.

_[tool: str_replace_edit]_

_[tool: read_file]_

Indentation mismatch on edit 8. Let me redo the batch, splitting and matching the actual indentation.

_[tool: str_replace_edit]_

Now make `AnimalInfo` editable. I'll add an Edit toggle in the section header — tapping it converts KV rows into editable inputs.

_[tool: str_replace_edit]_

Now make AnimalDocs support edit/delete on each doc (small action menu). Also wire it to onToast.

_[tool: str_replace_edit]_

Now add the script tag to index.html.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

One concern: `MultiChips` is used in my new file but only lives inside `screens-forms.jsx`'s scope. Need to expose it on window.

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Done — here's what's new:

**Tap any activity** → bottom sheet slides up with full details, a summary callout, meds table (for treatments), every field grouped, and an audit section showing who logged/edited it. Three actions at the bottom: **Delete · Duplicate · Edit**.

**Edit mode** flips the sheet into a form using the same controls as logging, so any field on any activity type can be corrected — including the timestamp.

**Animal Details tab** now has an Edit toggle in the header — tap it, every field becomes inline-editable (textareas for long text, selects for enums like status / vaccination / surgery req). Save / Cancel commits the patch.

**Documents** got per-row Rename and Delete actions.

**Deletes are reversible** — a dark toast with "Undo" appears for ~5s.

**Audit trail** — edits stamp `editedBy` / `editedAt`; the sheet shows it, and feed cards display a subtle "· edited" tag.

Other UX ideas you could add next if useful: drag activities to reorder on the timeline; tap a chief-complaint field anywhere to quick-edit without entering full edit mode; add "request review" so a doctor can flag a staff entry; bulk-export edited records.

## User

Verifier agent check completed

## Assistant

_[tool: str_replace_edit]_

Good catch. Lifting the sheet state to `App` so it renders as a sibling of the other sheets (above the scrollable body).Now strip the local ActivitySheet/UndoToast from AnimalDetailScreen and accept the lifted callbacks via props.

_[tool: str_replace_edit]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Fixed — sheet now mounts at the app root so it floats correctly over the device frame regardless of scroll position. Same for the undo toast.

## User

Verifier agent check completed

## Assistant

All clear — verifier confirmed the sheet positioning fix and the Details-tab edit toggle. You're set.

