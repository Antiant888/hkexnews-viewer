const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'all-news.json');

async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DATA_FILE);
  } catch (e) {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readAllNews() {
  await ensureDataFile();
  const txt = await fs.readFile(DATA_FILE, 'utf8');
  try {
    return JSON.parse(txt);
  } catch (e) {
    return [];
  }
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

async function writeAllNewsAtomic(list) {
  const tmp = DATA_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
  await fs.rename(tmp, DATA_FILE);
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
  await ensureDataFile();
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fetch failed ' + res.status);
  const json = await res.json();
  const items = extractArrayFromJson(json).map(normalize).filter(Boolean);
  const existing = await readAllNews();
  const map = new Map();
  for (const it of existing) {
    if (it && it.newsId) map.set(it.newsId, it);
  }
  let added = 0;
  let ignored = 0;
  for (const it of items) {
    if (!it) continue;
    if (!it.newsId) {
      const key = (it.title || '') + '|' + (it.pubTime || it.publishTime || '');
      it.newsId = 'gen_' + Buffer.from(key).toString('base64').slice(0, 12);
    }
    if (!map.has(it.newsId)) {
      map.set(it.newsId, it);
      added++;
    } else {
      ignored++;
    }
  }
  const merged = Array.from(map.values());
  merged.sort((a, b) => getTime(b) - getTime(a));
  await writeAllNewsAtomic(merged);
  return { added, ignored, total: merged.length };
}

async function mergeNewsFromDynamicSource(baseUrl, name) {
  await ensureDataFile();
  const maxPages = await getMaxPageCount(baseUrl);
  const items = await fetchDynamicSource(baseUrl, maxPages);
  const normalized = items.map(normalize).filter(Boolean);
  
  const existing = await readAllNews();
  const map = new Map();
  for (const it of existing) {
    if (it && it.newsId) map.set(it.newsId, it);
  }
  
  let added = 0;
  let ignored = 0;
  for (const it of normalized) {
    if (!it) continue;
    if (!it.newsId) {
      const key = (it.title || it.lTxt || '') + '|' + (it.relTime || it.pubTime || it.publishTime || '');
      it.newsId = 'gen_' + Buffer.from(key).toString('base64').slice(0, 12);
    }
    if (!map.has(it.newsId)) {
      map.set(it.newsId, it);
      added++;
    } else {
      ignored++;
    }
  }
  
  const merged = Array.from(map.values());
  merged.sort((a, b) => getTime(b) - getTime(a));
  await writeAllNewsAtomic(merged);
  return { added, ignored, total: merged.length, source: name, pages: maxPages };
}

module.exports = { readAllNews, mergeNewsFromUrl, expandPattern, mergeNewsFromDynamicSource, getMaxPageCount };
