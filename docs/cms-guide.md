# Robbe CMS Studio guide

Robbe CMS Studio is the local control room for articles and workshops. It is a
static application at `/admin` and contains no GitHub token, login system, or
direct remote-write capability.

## Open the Studio

```powershell
python demo_website.py
```

Open `http://127.0.0.1:4321/admin`. The Studio also works in the simulated
`/aiindeklas/admin` build because its content index and links use the shared base
path.

## Browse and edit

- Switch between **Artikels** and **Workshops**.
- Filter by text, locale, status, and publication year; sort by date or title.
- Select a record to open its schema-driven form and live draft preview.
- Use **Nieuw artikel** for a clean local draft or **Dupliceer artikel** to make
  a draft copy without carrying source provenance or publication status.
- Workshop fields expose duration, type, summary, programme, audience, delivery
  modes, learning goals, costs, group size, and booking details without requiring
  raw YAML editing.

The Studio edits an in-memory copy. Closing or reloading the page discards
unexported work.

## Validate and export

Choose **Valideer** before export. The Studio enforces required fields, safe
slugs and paths, publication metadata, source provenance pairing, and workshop
constraints. **Exporteer patch** downloads a deterministic JSON patch bundle;
it does not edit the repository or contact GitHub.

Validate the downloaded bundle from the repository root:

```powershell
pnpm cms:patch validate "C:\Users\robbe\Downloads\cms-article-example.patch.json"
```

Apply it only after inspecting its content:

```powershell
pnpm cms:patch apply "C:\Users\robbe\Downloads\cms-article-example.patch.json"
pnpm quality:p6
git diff -- src/content
```

The apply command accepts only Markdown files below `src/content/articles` or
`src/content/workshops`. Updates require the exact SHA-256 hash that the Studio
loaded, so a stale patch cannot overwrite a newer edit. New files cannot replace
existing files. If repository validation fails, the command restores every
changed file.

Review the Git diff and commit locally when satisfied. Publishing to GitHub
remains unavailable until H3 is approved.

## Media and thumbnails

The article form can select an existing migrated media ID for `seo.image`. That
field supplies the onderwijs listing thumbnail. Media with unresolved alt text
or publication rights remains flagged for P7; selecting it does not approve it.
New binary uploads are kept outside the browser workflow for now and must go
through the controlled asset pipeline and editorial review.

## Security boundary

`/admin` is an authoring convenience, not an authentication boundary. It is
always `noindex, nofollow`, but that is not access control. The generated Studio
contains only already-migrated content and can only export a local file. Never
add tokens, credentials, private drafts, or secrets to its client code or static
content endpoint.
