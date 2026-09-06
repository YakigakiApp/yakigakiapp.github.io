# PATH websites

Public product websites and compatibility redirects for PATH.

## Published URLs

- [PATH hub](https://path-biz.com/)
- [Passage](https://path-biz.com/passage/)
- [RatioFit](https://path-biz.com/ratiofit/)
- [Timeline Visualizer](https://path-biz.com/timeline-visualizer/)
- [Commercial transaction disclosure](https://path-biz.com/legal/)
- [Website privacy policy](https://path-biz.com/privacy/)
- [Passage privacy policy](https://path-biz.com/passage/privacy/)
- [RatioFit privacy policy](https://path-biz.com/ratiofit/privacy/)

## Production publishing

Cloudflare Workers Builds is connected to this repository. Pushes to `main` build and deploy the production website to the existing `path-website-migration-preview` Worker, which serves `path-biz.com`. The Worker name is historical; it currently serves production. Non-production branch builds are disabled.

Build and deploy commands are configured in the Cloudflare dashboard. The build copies only these public files and directories into `dist`:

```text
_redirects ads.txt app-ads.txt assets index.html legal legal.html passage path
policy-navigation.css posts.js privacy ratiofit robots.txt script.js
sitemap.xml style.css timeline-visualizer
```

The deployment uses Wrangler 4.129.0 with `html_handling: auto-trailing-slash` and `not_found_handling: none`. Routes are managed in the Cloudflare dashboard. README files, GitHub workflows and legacy redirect sources are not copied into the production artifact.

## Legacy iOS support links

The `legacy-pages` branch contains a separate GitHub Pages workflow and the `legacy-pages/index.html` redirect page. Only pushes to that branch publish GitHub Pages; `main` does not publish to GitHub Pages.

`https://yakigakiapp.github.io/` displays a migration notice and redirects to `https://path-biz.com/passage/`. Keep this available for older iOS app versions whose support button opens the GitHub URL.

GitHub Pages has no custom domain. Do not add a `CNAME` file or reconnect `path-biz.com` to GitHub Pages.

## Updating the website

1. Make website changes from the latest `main` checkout. Keep app-facing URLs compatible, particularly `/ratiofit/privacy/` and `/legal.html#ratiofit`.
2. Check desktop and mobile layouts, product links and legal navigation before committing. Keep `ads.txt` and `app-ads.txt` at the domain root; change their contents only when the advertising configuration requires it.
3. Push the reviewed changes to `main`, then confirm the Cloudflare build succeeds and verify the affected production pages. A new top-level public file or directory must also be added to the Cloudflare build allowlist.
4. Update the legacy redirect only on `legacy-pages`. Confirm its GitHub Actions deployment and the full old-app redirect path after changes.

DNS and domain email settings are managed separately. Routine website updates must not change MX, SPF, other mail records or unrelated DNS settings.