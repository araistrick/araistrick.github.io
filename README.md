# araistrick.com

Alexander Raistrick’s personal site, built with [Quartz 4](https://quartz.jzhao.xyz/).

## Local development

Quartz 4 requires Node.js 22 or newer.

```sh
npm ci
npx quartz build --serve
```

The local site is served at `http://localhost:8080`. Site content lives in `content/`, the layout is configured in `quartz.layout.ts`, and the visual system lives in `quartz/styles/custom.scss`.

## DigitalOcean App Platform

The repository includes [`.do/app.yaml`](.do/app.yaml), which defines a free static App Platform deployment from the `develop` branch. It runs `npm ci && npx quartz build` and serves the generated `public/` directory.

1. In DigitalOcean, choose **Create → App Platform → GitHub** and select `araistrick/araistrick.github.io`.
2. Import `.do/app.yaml` when prompted, or enter the same build settings manually.
3. Deploy and verify the temporary `*.ondigitalocean.app` URL before changing DNS.
4. In the app’s **Networking** tab, add `araistrick.com` as the primary domain and `www.araistrick.com` as an alias. Choose **You manage your domain**.

### DNS cutover

At the current DNS provider, lower the existing web-record TTL to 300 seconds before the cutover. Preserve all MX and TXT records.

For the apex domain, add both App Platform ingress addresses:

| Type | Host | Value            |
| ---- | ---- | ---------------- |
| A    | `@`  | `162.159.140.98` |
| A    | `@`  | `172.66.0.96`    |

For `www`, add the CNAME target shown in the DigitalOcean Networking tab:

| Type  | Host  | Value                                     |
| ----- | ----- | ----------------------------------------- |
| CNAME | `www` | the app’s `*.ondigitalocean.app` hostname |

Remove only conflicting `@` A/AAAA records and the old `www` A/CNAME record. If the zone has CAA records, authorize both `letsencrypt.org` and `pki.goog` so App Platform can issue TLS certificates. Once DNS and HTTPS are healthy, raise the TTL again.

The static App Platform tier is preferable to a Droplet here: it supplies builds, CDN delivery, and managed TLS without a server to patch.
