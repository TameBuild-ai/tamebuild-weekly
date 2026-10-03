// Reads config.json at runtime rather than importing it, so the build script
// and the functions share one file and a change to it (the mailing address,
// say) needs no code edit. Functions ship config.json through included_files
// in netlify.toml; see the note there.

import fs from "node:fs";

const CONFIG_URL = new URL("../config.json", import.meta.url);

let cached;
export function getConfig() {
  if (!cached) cached = Object.freeze(JSON.parse(fs.readFileSync(CONFIG_URL, "utf8")));
  return cached;
}

// https://tamebuild.ai/weekly + path. Canonical, feed and email links always
// use the public address, never the netlify.app one.
export function publicUrl(path = "/") {
  const c = getConfig();
  return c.siteUrl + c.basePath + (path.startsWith("/") ? path : "/" + path);
}

// Links people click in emails (confirm, unsubscribe, hold). Until the
// tamebuild.ai /weekly proxy is live, tamebuild.ai/weekly/... does not exist,
// so these use the netlify.app address. Set "proxyLive": true in config.json
// once the main site's proxy rule is deployed.
export function linkUrl(path = "/") {
  const c = getConfig();
  const origin = c.proxyLive ? c.siteUrl : c.netlifyUrl;
  return origin + c.basePath + (path.startsWith("/") ? path : "/" + path);
}
