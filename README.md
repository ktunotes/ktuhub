# KTU Notes Hub

Notes, question papers and syllabus for KTU courses beyond B.Tech (MCA, MBA, BCA, BBA, M.Tech, B.Arch, B.Des, BHMCT). A static site for GitHub Pages, with an admin panel at `/admin.html`.

## Files

| Path | What it is |
|---|---|
| `index.html` | The public site |
| `admin.html` | The admin panel (not linked from the site, hidden from Google) |
| `assets/` | Styles, scripts, logo |
| `data/catalog.json` | All courses, subjects and the list of notes. The admin panel edits this. |
| `files/` | PDFs uploaded through the admin panel |

## 1. Put it on GitHub Pages

1. Create a **public** repository, for example `hub`.
2. Upload everything in this folder to the repository (keep the folder structure, including the empty `.nojekyll` file).
3. Go to **Settings → Pages**, set **Source: Deploy from a branch**, **Branch: main**, folder **/(root)**, and save.
4. After a minute the site is live at `https://<your-username>.github.io/hub/`.

### Use hub.ktunotes.in instead

1. In Cloudflare DNS, add a **CNAME** record: name `hub`, target `<your-username>.github.io`. Set it to **DNS only** (grey cloud) until GitHub has issued the certificate, then you can switch the proxy on.
2. In **Settings → Pages → Custom domain**, enter `hub.ktunotes.in` and save. Tick **Enforce HTTPS** once it becomes available.

## 2. Create the admin token (once)

The admin panel saves straight into the repository, so it needs a GitHub token that can write to it.

1. On GitHub: **profile picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** *Only select repositories* → choose this repository only.
3. **Permissions → Repository permissions → Contents:** *Read and write*. Nothing else is needed.
4. Set an expiry (for example 1 year) and generate. Copy the token.

Keep the token private: anyone with it can change this repository. It is stored only in the browser where you tick "Remember on this device".

## 3. Add notes

1. Open `https://<your-site>/admin.html` and connect with your username, repository name, branch (`main`) and the token.
2. **Subjects** tab: add the subjects for a semester (course code and name).
3. **Add notes** tab: pick course, semester, subject and type, then upload PDFs (up to 25 MB each) or paste a Google Drive link.
4. The site updates in a minute or two. GitHub Pages can cache pages for up to 10 minutes, so a hard refresh may be needed.

Every change is a normal commit, so you can see the history and undo anything from GitHub itself.

## Limits to know

- GitHub recommends keeping a repository under about **1 GB**. For large collections, upload big PDFs to Google Drive and add them with **Paste a link**.
- Files over 25 MB can't be uploaded through the panel; use a link instead.
