---
title: How to write a post
description: Add a Markdown file, fill in three fields, and you're done.
pubDate: 2026-11-15
---

Every post is a Markdown file in `src/data/blog/`. The file name becomes the URL, so `my-first-post.md` is served at `/blog/my-first-post`.

## Frontmatter

Each post starts with three fields:

```md
---
title: My first post
description: A one-line summary for the post list and RSS feed.
pubDate: 2026-01-01
---
```

## What you get

- The post shows up on `/blog`, newest first.
- Reading time is estimated automatically.
- The home page shows a Blog tile as soon as you have at least one post.
