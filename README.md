# passage-official

## Publishing

Production website: https://path-biz.com/

Cloudflare Workers Builds is connected to this repository. Pushes to `main` build and deploy the current static website. Non-production branch builds are disabled. Build and deploy commands are configured in the Cloudflare dashboard.

The initial migration preserves the existing page paths, `ads.txt`, and `app-ads.txt`. The PATH hub and product URL reorganization will be published separately.

GitHub Pages remains enabled temporarily for compatibility with links in existing app versions. Keep the existing DNS and email settings unchanged during this transition.
