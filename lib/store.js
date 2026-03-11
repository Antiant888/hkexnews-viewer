require('dotenv').config();
const { Pool } = require('pg');
const fetch = require('node-fetch');

// 1. Better date parsing
const parseFlexibleDate = (val) => {
  if (!val) return null;
  if (typeof val === 'number') return new Date(val * 1000); // unix seconds → ms

  // Try ISO, then common formats
  let dt = new Date(val);
  if (!isNaN(dt.getTime())) return dt;

  // Chinese style 年月日
  val = val.replace(/[年月日]/g, '-').replace(/时/g, ':').replace(/分/g, ':').replace(/秒/g, '');
  dt = new Date(val);
  if (!isNaN(dt.getTime())) return dt;

  return null;
};

// 2. Add timeout + basic retry to fetch
async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s

      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (attempt === retries + 1) throw err;
      await new Promise(r => setTimeout(r, 800 * attempt)); // backoff
    }
  }
}

// 3. Parallel fetching with limit (better throughput, still polite)
const pLimit = (concurrency) => {
  let running = 0;
  const queue = [];
  return (fn) => new Promise((res, rej) => {
    const run = async () => {
      running++;
      try { res(await fn()); } catch (e) { rej(e); } finally { running--; next(); }
    };
    const next = () => { if (queue.length && running < concurrency) queue.shift()(); };
    queue.push(run);
    next();
  });
};

const limit = pLimit(4); // max 4 concurrent requests

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // For Railway, adjust as needed
});

async function ensureDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS news (
        newsId TEXT PRIMARY KEY,
        title TEXT,
        content TEXT,
        summary TEXT,
        url TEXT,
        pubTime TIMESTAMP,
        stock JSONB,
        stockCode TEXT,
        stockName TEXT,
        otherData JSONB
      );
    `);
  } finally {
    client.release();
  }
}

async function readAllNews() {
  await ensureDatabase();
  const res = await pool.query('SELECT * FROM news ORDER BY pubTime DESC');
  return res.rows;
}

function extractArrayFromJson(obj) {
  if (Array.isArray(obj)) return obj;
  for (const k of Object.keys(obj)) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  const vals = Object.values(obj).flatMap(v => (Array.isArray(v) ? v : []));
  if (vals.length) return vals;
  return [];
}

function normalize(item) {
  if (!item) return item;
  if (!item.newsId && (item.id || item.docID || item.newsId)) {
    item.newsId = item.id || item.docID || item.newsId;
  }
  return item;
}

function getTime(item) {
  const candidates = ['pubTime', 'publishTime', 'date', 'time', 'timestamp', 'postTime', 'publish_date'];
  for (const c of candidates) {
    if (item && item[c]) {
      const t = new Date(item[c]).getTime();
      if (!isNaN(t)) return t;
    }
  }
  return 0;
}

function expandPattern(srcObj) {
  if (srcObj.url) return [srcObj.url];
  if (srcObj.pattern && srcObj.start !== undefined && srcObj.end !== undefined) {
    const urls = [];
    for (let i = srcObj.start; i <= srcObj.end; i++) {
      urls.push(srcObj.pattern.replace('{index}', i));
    }
    return urls;
  }
  if (srcObj.dynamic && srcObj.baseUrl) {
    return { dynamic: true, baseUrl: srcObj.baseUrl, name: srcObj.name };
  }
  return [];
}

async function getMaxPageCount(baseUrl) {
  const url = baseUrl + '_1.json';
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error('Failed to fetch page count from ' + url);
  const json = await res.json();
  return json.maxNumOfFile || 1;
}

async function fetchDynamicSource(baseUrl, maxPages) {
  const promises = [];
  for (let i = 1; i <= maxPages; i++) {
    const url = `${baseUrl}_${i}.json`;
    promises.push(
      limit(async () => {
        try {
          const res = await fetchWithRetry(url);
          const json = await res.json();
          return json.newsInfoLst || extractArrayFromJson(json) || [];
        } catch (e) {
          console.warn(`Page ${i} failed: ${e.message}`);
          return [];
        }
      })
    );
  }
  const pagesData = await Promise.all(promises);
  const allItems = pagesData.flat();
  return allItems;
}

async function mergeNewsFromUrl(url) {
  await ensureDatabase();
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error('Fetch failed ' + res.status);
  const json = await res.json();
  const items = extractArrayFromJson(json).map(normalize).filter(Boolean);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    let added = 0;
    let ignored = 0;
    
    for (const it of items) {
      if (!it) continue;
      if (!it.newsId) {
        const key = (it.title || '') + '|' + (it.pubTime || it.publishTime || '');
        it.newsId = 'gen_' + Buffer.from(key).toString('base64').slice(0, 12);
      }
      
      let pubDate = null;
      const timeCandidate = it.pubTime;
      if (timeCandidate) {
        pubDate = parseFlexibleDate(timeCandidate);
      }

      const { rowCount } = await client.query(
        `INSERT INTO news (newsId, title, content, summary, url, pubTime, stock, stockCode, stockName, otherData)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (newsId) DO NOTHING`,
        [
          it.newsId,
          it.title,
          it.content,
          it.summary,
          it.url,
          pubDate,
          JSON.stringify(it.stock || {}),
          it.stockCode,
          it.stockName,
          JSON.stringify(it) // Store full item for flexibility
        ]
      );
      
      if (rowCount > 0) added++;
      else ignored++;
    }
    
    await client.query('COMMIT');
    return { added, ignored, total: added + ignored };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function mergeNewsFromDynamicSource(baseUrl, name) {
  await ensureDatabase();
  const maxPages = await getMaxPageCount(baseUrl);
  const items = await fetchDynamicSource(baseUrl, maxPages);
  const normalized = items.map(normalize).filter(Boolean);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    let added = 0;
    let ignored = 0;
    
    for (const it of normalized) {
      if (!it) continue;
      if (!it.newsId) {
        const key = (it.title || it.lTxt || '') + '|' + (it.relTime || it.pubTime || it.publishTime || '');
        it.newsId = 'gen_' + Buffer.from(key).toString('base64').slice(0, 12);
      }
      
      let pubDate = null;
      const timeCandidate = it.relTime || it.pubTime;
      if (timeCandidate) {
        pubDate = parseFlexibleDate(timeCandidate);
      }

      const { rowCount } = await client.query(
        `INSERT INTO news (newsId, title, content, summary, url, pubTime, stock, stockCode, stockName, otherData)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (newsId) DO NOTHING`,
        [
          it.newsId,
          it.title || it.lTxt,
          it.content,
          it.summary,
          it.url,
          pubDate,
          JSON.stringify(it.stock || {}),
          it.stockCode,
          it.stockName,
          JSON.stringify(it)
        ]
      );
      
      if (rowCount > 0) added++;
      else ignored++;
    }
    
    await client.query('COMMIT');
    return { added, ignored, total: added + ignored, source: name, pages: maxPages };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { readAllNews, mergeNewsFromUrl, expandPattern, mergeNewsFromDynamicSource, getMaxPageCount };