# Tame the Week

The public site for **Tame the Week: AI News for Small Business**, served at
<https://tamebuild.ai/weekly/>.

This repo holds only what is published: page templates, the static build,
published weekly issues and editorials, and the small functions behind the
signup form and the draft hold page. The research and fact-checking pipeline
that writes each issue lives in a separate private repo.

- `content/issues/YYYY-MM-DD.md` - one file per published issue.
- `content/editorials/<slug>.md` - editorials; see `content/editorials/README.md`.
- `config.json` - site and email settings, including the mailing address
  printed in every subscriber email.
- `npm run build` writes `dist/weekly/`; `npm run check` validates content only.

A commit to `main` that changes content or code triggers one Netlify
production build. Changes to this README do not.
