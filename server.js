const express = require('express');
const path = require('path');
const fs = require('fs');
const { mergeNewsFromUrl, readAllNews, expandPattern, mergeNewsFromDynamicSource } = require('./lib/store');

const app = express();
app.use(express.json());
app.use(require('cors')());

const PORT = process.env.PORT || 3000;

// Track last auto fetch time
let lastAutoFetchTime = null;

// Start the news scheduler
if (process.env.NODE_ENV !== 'test') {
  try {
    console.log('🔧 Loading scheduler module...');
    require('./scripts/scheduler');
    console.log('✅ Scheduler module loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load scheduler:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/config', express.static(path.join(__dirname, 'config')));

app.get('/api/news', async (req, res) => {
  try {
    const all = await readAllNews();
    const q = req.query.q;
    const preset = req.query.preset;
    let list = all;
    if (preset) {
      const filtersPath = path.join(__dirname, 'config', 'filters.json');
      if (fs.existsSync(filtersPath)) {
        const filters = JSON.parse(fs.readFileSync(filtersPath, 'utf8'));
        const f = filters.find(x => x.name === preset);
        if (f && f.keywords && f.keywords.length) {
          const kws = f.keywords.map(k => k.toLowerCase());
          list = list.filter(item => {
            const text = ((item.title || '') + ' ' + (item.content || '') + ' ' + (item.summary || '')).toLowerCase();
            return kws.some(k => text.includes(k));
          });
        }
      }
    }
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter(item => {
        const text = ((item.title || '') + ' ' + (item.content || '') + ' ' + (item.summary || '')).toLowerCase();
        return text.includes(qq);
      });
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fetch', async (req, res) => {
  try {
    const sourcesPath = path.join(__dirname, 'config', 'sources.json');
    let sources = [];
    if (fs.existsSync(sourcesPath)) {
      sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    }
    if (req.body && req.body.url) {
      sources = [{ url: req.body.url }];
    }
    
    const results = [];
    
    for (const src of sources) {
      try {
        if (src.dynamic && src.baseUrl) {
          // Handle dynamic source (fetch maxNumOfFile then loop through pages)
          const result = await mergeNewsFromDynamicSource(src.baseUrl, src.name);
          results.push({ name: src.name, baseUrl: src.baseUrl, added: result.added, ignored: result.ignored, pages: result.pages });
        } else {
          // Handle pattern-based or simple URL source
          const expanded = expandPattern(src);
          if (Array.isArray(expanded)) {
            for (const url of expanded) {
              const result = await mergeNewsFromUrl(url);
              results.push({ url: url, added: result.added, ignored: result.ignored });
            }
          }
        }
      } catch (e) {
        results.push({ source: src.name || src.url || src.baseUrl, error: e.message });
      }
    }
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API endpoint to get last auto fetch time
app.get('/api/last-fetch-time', (req, res) => {
  try {
    res.json({
      lastAutoFetchTime: lastAutoFetchTime,
      lastAutoFetchTimeFormatted: lastAutoFetchTime ? lastAutoFetchTime.toLocaleString('en-HK', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) : null
    });
  } catch (error) {
    console.error('Error getting last fetch time:', error);
    res.status(500).json({ error: 'Failed to get last fetch time' });
  }
});

// API endpoint to update last auto fetch time
app.post('/api/update-last-fetch', (req, res) => {
  try {
    const { timestamp } = req.body;
    if (timestamp) {
      lastAutoFetchTime = new Date(timestamp);
      console.log('📅 Last auto fetch time updated:', lastAutoFetchTime.toLocaleString('en-HK'));
    }
    res.json({ success: true, lastAutoFetchTime: lastAutoFetchTime });
  } catch (error) {
    console.error('Error updating last fetch time:', error);
    res.status(500).json({ error: 'Failed to update last fetch time' });
  }
});

app.listen(PORT, () => console.log(`Server listening http://localhost:${PORT}`));
