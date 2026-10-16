# Mon Espace Français — complete website

A single-student responsive French learning website. Upload all contents of this folder **to the root** of a public GitHub repository and enable Settings → Pages → Deploy from a branch → main → /(root).

## Files
- `index.html` — complete interface (Home, Weekly practice, Speaking, Listening, Resources).
- `config.json` — student display name, time zone, week file paths, resource links.
- `weeks/week1.json` — preserved A1 Week 1 syllabus, four existing days plus three future placeholders.

## Daily workflow
Student learns from Weekly practice, reviews five swipeable flashcards, answers in a paper notebook, reveals explanations, copies the AI marking prompt, opens ChatGPT in another tab, pastes prompt and uploads notebook pictures, then enters the resulting score and marks the day complete.

The website cannot upload photos itself or run AI corrections itself. ChatGPT needs the **pasted prompt AND photos**. AI responses can be mistaken and handwriting can be unclear.

## Adding future weeks
Send your syllabus here to create `weeks/week2.json`, then upload the new file into `weeks/` and add `"weeks/week2.json"` to the `weeks` list in `config.json`. Choose release dates within each day. The design stays unchanged.

## Important
This is a static public GitHub Pages site, **not** a private classroom. All scores and completed-day states are saved only in the current browser's localStorage, not synced with the teacher or other devices. The Listening tab speaks the lesson's existing model sentences using browser speech synthesis; it does not provide new recordings. Some phones/devices may not offer a French voice.

To preview locally (if needed): run `python -m http.server 8000` in this folder and visit http://localhost:8000 . Opening `index.html` directly without a server can block JSON loading.

## Updated home page
Home displays a welcome message, the number of completed days, and four square navigation tiles only. All lesson details, scoring, and practice stay in their own sections.
