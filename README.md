# Bruno Farfan Miquel Portfolio Scaffold

A lightweight Astro, React, and TypeScript personal portfolio scaffold.

The site is mostly static and uses Astro pages for routing. React is included only for a small theme toggle island to confirm integration.

## Project Structure

```text
/
├── public
├── src
│   ├── components
│   ├── data
│   ├── layouts
│   ├── pages
│   └── styles
└── package.json
```

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`                 | Starts local dev server at `localhost:4321`      |
| `pnpm build`               | Builds the production site to `./dist/`          |
| `pnpm preview`             | Previews the production build locally            |
| `pnpm astro ...`           | Runs Astro CLI commands                          |

## Routes

- `/`
- `/work`
- `/work/ai-reimbursement-automation`
- `/work/document-intelligence-pipelines`
- `/lab`
- `/lab/ogai`
- `/lab/mike`
- `/lab/future-experiments`
- `/about`
- `/contact` redirects to `/about`
