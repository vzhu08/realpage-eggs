# Labeled backup of the walkthrough

**Synthetic rehearsal on fictional data. Not actual law, not a real property, not a real result.**

These frames are an alternative Track B rehearsal described in `../DEMO_SCRIPT.md`. They exist so the journey can still be
shown if the live real-data demo cannot run. Every frame carries the app’s own “Synthetic
demo” banner. Say that it is a rehearsal on fictional data before showing any of it.

- `01`–`13` `*.jpg`: one frame per step, 1280×720.
- `synthetic-walkthrough.webm`: the same run as one recording (about 50 seconds). It is not
  checked in; regenerate it with the command below.

Regenerate after the UI changes:

    DEMO_BACKUP=1 npm run demo:backup            # macOS/Linux
    $env:DEMO_BACKUP='1'; npm run demo:backup    # PowerShell

What it is not: a recording of the real-data journey. That recording has to be made against
the integrated snapshot once PLAT-06 and CORE-06 land, with the examples chosen in
`../DEMO_SCRIPT.md`, and labeled with the snapshot it was made from.

Integration note (October 4, 2026): the frames and local video were regenerated from the
native Vite build after the three Claude workers were integrated. The lookup is DEV-P08
(61 Ember Road), Jan 15, 2027. Applying the recorded “No” owner-occupancy answer leaves the
conflicting fee rules unknown; the recording then shows portfolio totals, the timeline,
source → rule → property detail, evaluator conflicts and a working export. The shorter
one-click walkthrough in `../DEMO_SCRIPT.md` instead uses DEV-P04 with a units answer.

The backup is software/demo evidence only. Real-snapshot rehearsal remains separate; see
`../NATIVE_UX_REVIEW.md` for the native verification record and its limits.
