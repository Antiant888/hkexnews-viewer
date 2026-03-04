const path = require('path');
const fs = require('fs');
const { mergeNewsFromUrl, expandPattern, mergeNewsFromDynamicSource } = require('../lib/store');

(async () => {
  try {
    const sourcesPath = path.join(__dirname, '..', 'config', 'sources.json');
    let sources = [];
    if (fs.existsSync(sourcesPath)) {
      sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    }
    if (process.argv[2]) {
      sources = [{ url: process.argv[2] }].concat(sources);
    }
    
    for (const src of sources) {
      try {
        if (src.dynamic && src.baseUrl) {
          // Handle dynamic source (fetch maxNumOfFile then loop through pages)
          const result = await mergeNewsFromDynamicSource(src.baseUrl, src.name);
          console.log('Fetched dynamic source', src.name, result);
        } else {
          // Handle pattern-based or simple URL source
          const expanded = expandPattern(src);
          if (Array.isArray(expanded)) {
            for (const url of expanded) {
              const result = await mergeNewsFromUrl(url);
              console.log('Fetched', url, result);
            }
          }
        }
      } catch (e) {
        console.error('Error fetching source', src.name || src.url || src.baseUrl, e.message);
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
