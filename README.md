# Study Club

Study Club is a no-build JavaScript study app for terms, question practice, and local progress tracking. It uses plain HTML, CSS, and ES modules; there are no package installs or build steps.

## Run locally

Serve the repository root with any static HTTP server. For example, with Python:

```powershell
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a modern browser. Do not open `index.html` directly with `file://`: the app uses `fetch()` and browser modules, which require an HTTP server.

## Using the app

- Choose topics, levels, and search terms with the shared filters.
- Study terms with flashcards, multiple choice, and English or Arabic spelling.
- Build practice sessions from the filtered question pool.
- Track weak questions and term status in Progress.
- Export a JSON backup or import one on another browser/device. Progress is stored locally in this browser.

Keyboard shortcuts are available from the “Keyboard shortcuts” disclosure below the filters. Reduced-motion preferences are respected, and the layout adapts to mobile screens.
