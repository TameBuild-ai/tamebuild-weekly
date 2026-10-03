// Site and email settings live in config.json so the mailing address and
// sender details change without a code edit. Imported as JSON (not read with
// fs) so Netlify's function bundler inlines it: a runtime file read resolves
// against the bundled function's own folder and misses the file.

import config from "../config.json" with { type: "json" };

export function getConfig() {
  return config;
}

// https://tamebuild.ai/weekly + path. Canonical, feed and email links always
// use the public address, never the netlify.app one.
export function publicUrl(path = "/") {
  const c = getConfig();
  return c.siteUrl + c.basePath + (path.startsWith("/") ? path : "/" + path);
}

// Links people click in emails (confirm, hold). Until the
// tamebuild.ai /weekly proxy is live, tamebuild.ai/weekly/... does not exist,
// so these use the netlify.app address. Set "proxyLive": true in config.json
// once the main site's proxy rule is deployed.
export function linkUrl(path = "/") {
  const c = getConfig();
  const origin = c.proxyLive ? c.siteUrl : c.netlifyUrl;
  return origin + c.basePath + (path.startsWith("/") ? path : "/" + path);
}
