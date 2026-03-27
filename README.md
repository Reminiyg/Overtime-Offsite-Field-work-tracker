# WorkLog (Offline, Free, iOS-Compatible)

No Claude/API dependency, no paid services, no external runtime dependency.

## Features implemented

- Timer (start/stop + apply to hours)
- Smart text parser (fills type/client/time/hours/activity/reason)
- Auto project tagging
- Daily/weekly summary in Monthly Summary
- Export monthly data to CSV
- Export PDF via print dialog (`window.print()`)
- Offline persistence via `localStorage`

## Run

Open `index.html` directly in a browser.

For iPhone:

1. Host files on any static host (GitHub Pages / Netlify free).
2. Open on Safari.
3. Share -> Add to Home Screen.

## Smart text examples

- `Nike setup shoot 9:30-12:00 overtime reason launch preparation`
- `meeting for Adidas 2.5 hrs execution`

## Notes

- Parser and auto-tag are rule-based (fully offline + free).
- For stronger AI later, add optional on-device model integration.
