# Labeled backup of the walkthrough

**Synthetic rehearsal on fictional data. Not actual law, not a real property, not a real result.**

These frames follow Track B of `../DEMO_SCRIPT.md`. They exist so the journey can still be
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

Integration note (October 4, 2026): the checked-in frames are Claude’s pre-integration
UX-04 capture. Core B v3 explanations and CORE-06’s additional uncertain comparison rows
are verified in the integration branch but are not depicted by these historical frames.
Regenerate the backup before a presentation of the integrated build.
