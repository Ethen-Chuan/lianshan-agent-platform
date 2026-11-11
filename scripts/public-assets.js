function publicAssets(html) {
  const assets = [...new Set([...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)].map(match => match[1]))];
  for (const asset of assets) {
    if (!/^[a-z0-9-]+\.(?:js|css)$/.test(asset) || /(?:^|-)server\.js$/.test(asset) || /^super-agent-(?:runtime|store|policy)\.js$/.test(asset)) {
      throw new Error(`Unexpected public asset: ${asset}`);
    }
  }
  return assets;
}

module.exports = {publicAssets};
