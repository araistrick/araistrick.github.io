# araistrick.com

A plain [Quartz 4](https://quartz.jzhao.xyz/) site. All page content is Markdown in `notes/`, and internal navigation uses Obsidian-style wikilinks.

## Local development

Quartz requires Node.js 22 or newer.

```sh
npm ci
npm run quartz -- build --directory notes --serve
```

## Obsidian

Open `notes/` as an Obsidian vault, or symlink this repository's `notes/` directory into an existing vault. Keep `notes/` as the real directory in this repository so GitHub Actions receives the files. Quartz resolves `[[wikilinks]]`; `.obsidian/` settings are ignored. Commit and push changed notes to `develop` to rebuild and publish the site automatically.

## GitHub Pages

Pushes to `develop` are built and published by `.github/workflows/deploy.yml`.

In the repository settings, select **Pages → Source → GitHub Actions** and set the custom domain to `araistrick.com`. Verify the domain at the account level before changing its DNS records, then enable **Enforce HTTPS** after GitHub provisions the certificate.
