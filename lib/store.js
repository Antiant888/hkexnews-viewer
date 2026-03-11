require('dotenv').config();
const { Pool } = require('pg');
const fetch = require('node-fetch');

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
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch page count from ' + url);
  const json = await res.json();
  return json.maxNumOfFile || 1;
}

async function fetchDynamicSource(baseUrl, maxPages) {
  const allItems = [];
  for (let i = 1; i <= maxPages; i++) {
    const url = baseUrl + '_' + i + '.json';
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('Failed to fetch', url, res.status);
        continue;
      }
      const json = await res.json();
      // Extract newsInfoLst if it exists; otherwise use whole response or search for arrays
      const items = json.newsInfoLst || extractArrayFromJson(json);
      allItems.push(...items);
    } catch (e) {
      console.warn('Error fetching', url, e.message);
    }
  }
  return allItems;
}

async function mergeNewsFromUrl(url) {
  await ensureDatabase();
  const res = await fetch(url);
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
        const tempDate = new Date(timeCandidate);
        if (!isNaN(tempDate.getTime())) {
          pubDate = tempDate;
        }
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
        const tempDate = new Date(timeCandidate);
        if (!isNaN(tempDate.getTime())) {
          pubDate = tempDate;
        }
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
