## Goal

Produce a single downloadable PDF of the Ubuntu deployment handbook that currently lives as 16 markdown files in `docs/deployment/`.

## What the PDF will contain

In this order:

1. Cover page — project name, "Quality Environment Deployment Handbook", date, version
2. Table of contents with page numbers
3. `README.md` (architecture overview + port map)
4. Guides `01` through `15`, each starting on a new page:
   - 01 Server preparation
   - 02 Node.js & Bun
   - 03 PM2
   - 04 Docker
   - 05 Self-hosted Supabase
   - 06 Database setup
   - 07 Backend (SAP middleware) deploy
   - 08 Frontend deploy
   - 09 Nginx install
   - 10 Nginx Quality config
   - 11 Environment variables
   - 12 Deployment process
   - 13 Monitoring & maintenance
   - 14 Troubleshooting
   - 15 Production later
5. Appendix — the shipped file inventory under `deploy/quality/` (env templates, nginx configs, PM2 ecosystem config, scripts) so the reader knows what to copy where

## Technical approach

- Build the PDF with a Python script (ReportLab Platypus) that parses each markdown file, not a plain text dump — so headings, tables, bullet lists and shell code blocks all render properly.
- Shell/config code blocks get a monospaced font on a light grey panel with wrapping so no command is cut off at the right margin.
- Markdown tables (port map, env variable matrices, log file tables) render as real bordered tables sized to the content width.
- US Letter, 1 inch margins, running footer with page numbers, DejaVu fonts registered so any non-ASCII characters render correctly.
- Output written to `/mnt/documents/resl-approval-deployment-handbook.pdf` and offered as a downloadable artifact.
- QA pass: convert every page to an image and inspect each one for clipped code lines, broken tables, overlapping text and bad page breaks; fix the generator and re-run until clean.

## Notes

- Nothing in the app or the existing markdown guides changes — this is purely an additional generated document.
- The markdown files stay the source of truth; if guides change later, the PDF is regenerated from them.
