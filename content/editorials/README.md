# Editorials

One Markdown file per editorial, named after its URL:
`content/editorials/why-i-built-this.md` publishes at
`https://tamebuild.ai/weekly/editorial/why-i-built-this/`.

Committing the file to `main` publishes it. Before committing, run
`npm run check`; it fails on anything the build would reject.

```markdown
---
title: Why I check every AI claim twice
author: Jeff Goddard
bio: Jeff builds working AI tools for small businesses in West Tennessee.
date: 2026-10-14
summary: One or two sentences that show on the index, in the feed and in link previews.
email: true
---
The editorial, in plain Markdown. Paragraphs, **bold**, *italics*,
[links](https://example.com) and lists all work.
```

Rules the build enforces:

- `title`, `author`, `bio`, `date` (YYYY-MM-DD) and `summary` are required.
- `email` is optional and defaults to `true`: once the page is live, the
  engine sends the editorial to subscribers as its own email, once. Set
  `email: false` to publish without emailing.
- The file name is lowercase words joined by hyphens.
- No em dash character anywhere.
- Editorials carry the byline and bio, not the AI footer used on weekly issues.
