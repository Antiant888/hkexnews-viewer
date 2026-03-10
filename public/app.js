async function fetchFilters() {
  try {
    const res = await fetch('/config/filters.json');
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function fetchNews(preset, q) {
  const params = new URLSearchParams();
  if (preset) params.set('preset', preset);
  if (q) params.set('q', q);
  const res = await fetch('/api/news?' + params.toString());
  if (!res.ok) return [];
  return await res.json();
}

function extractStockCodes(items) {
  const codes = new Set();
  items.forEach(item => {
    let code = '';
    if (Array.isArray(item.stock) && item.stock.length) {
      code = item.stock[0].sc || item.stock[0].code || '';
    }
    code = code || item.stockCode || item.stockcode || item.stock_code || item.code || '';
    if (code) codes.add(String(code).trim());
  });
  return Array.from(codes).sort();
}

function getDateForSort(item) {
  if (item.relTime) {
    const [datePart, timePart] = item.relTime.split(' ');
    if (!datePart || !timePart) return 0;
    
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // Parse as UTC with Z
    return new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00Z`).getTime();
  }

  // fallback remains the same
  const cand = item.pubtime || item.pubTime || item.publishTime || item.publish_date || item.date || item.time || item.timestamp || item.postTime;
  if (!cand) return 0;
  const d = new Date(cand);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function fmtDate(item) {
  if (item.relTime) return item.relTime;
  const cand = item.pubtime || item.pubTime || item.publishTime || item.publish_date || item.date || item.time || item.timestamp || item.postTime;
  if (!cand) return '';
  const d = new Date(cand);
  if (isNaN(d.getTime())) return String(cand);
  // Assume DB times are in UTC, convert to local timezone
  const offset = d.getTimezoneOffset() * 60000; // minutes to milliseconds
  const localTime = new Date(d.getTime() - offset);
  return localTime.toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong' });
}

function pick(vs) {
  for (const v of vs) if (v !== undefined && v !== null) return v;
  return undefined;
}

function truncate(s, len) {
  if (!s) return '';
  if (s.length <= len) return s;
  return s.slice(0, len).trim() + '…';
}

// Pagination state
let currentPage = 1;
const itemsPerPage = 20;
let currentList = [];
let currentFilterStockCode = '';

// Filter state
let currentFilters = {
  searchQuery: ''
};

function renderNews(list) {
  const el = document.getElementById('newsList');
  const paginationEl = document.getElementById('pagination');
  
  // Sort by date descending (latest first)
  list.sort((a, b) => {
    return getDateForSort(b) - getDateForSort(a);
  });
  
  // Apply search query filter
  let filtered = list;
  if (currentFilters.searchQuery) {
    const query = currentFilters.searchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      const text = ((item.title || '') + ' ' + (item.content || '') + ' ' + (item.summary || '')).toLowerCase();
      return text.includes(query);
    });
  }

  currentList = filtered;
  
  if (!filtered || !filtered.length) {
    el.innerHTML = '<p>No news found.</p>';
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  const sel = document.getElementById('summaryLength');
  const lenMap = { short: 80, medium: 200, full: 0 };
  const selVal = (sel && sel.value) || 'medium';
  const maxLen = lenMap[selVal] || 200;

  // Calculate pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = 1;
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, endIndex);

  // Render items with highlighting
  el.innerHTML = paginatedItems
    .map(n => {
      let code = '';
      let name = '';
      if (Array.isArray(n.stock) && n.stock.length) {
        code = n.stock[0].sc || n.stock[0].code || n.stock[0].ticker || '';
        name = n.stock[0].sn || n.stock[0].name || '';
      }
      code = code || pick([n.stockCode, n.stockcode, n.stock_code, n.stockCd, n.code, n.ticker, n.shortCode]) || '';
      name = name || pick([n.stockName, n.stockname, n.stock_name, n.company, n.issuer, n.companyName, n.issuerName]) || '';
      const title = pick([n.title, n.headline, n.subject]) || 'No title';
      const summary = pick([n.summary, n.content, n.description, n.abstract, n.note]) || '';
      const url = pick([n.url, n.link, n.linkUrl]) || '#';
      const date = fmtDate(n);
      const clean = summary.replace(/\s+/g, ' ');
      const short = maxLen === 0 ? clean : truncate(clean, maxLen);
      
      // Apply highlighting if search query exists
      const highlightedTitle = currentFilters.searchQuery ? highlightText(title, currentFilters.searchQuery) : title;
      const highlightedSummary = currentFilters.searchQuery ? highlightText(short, currentFilters.searchQuery) : short;
      const highlightedFull = currentFilters.searchQuery ? highlightText(clean, currentFilters.searchQuery) : clean;
      
      return `
      <article class="item compact">
        <div class="item-header">
          <h4 class="title"><a href="${url}" target="_blank">${highlightedTitle}</a></h4>
          <span class="release-date">${date}</span>
        </div>
        <div class="meta"><span class="code">${code}</span><span class="name">${name}</span></div>
        <p class="summary">${highlightedSummary}</p>
        <p class="full-content" style="display:none">${highlightedFull}</p>
        ${clean && clean !== short ? `<a class="toggle-full" href="#">Read more</a>` : ''}
      </article>`;
    })
    .join('\n');

  // Render pagination
  renderPagination(totalPages, paginationEl);
}

function renderPagination(totalPages, paginationEl) {
  if (!paginationEl) return;

  let paginationHTML = '';
  
  if (totalPages <= 1) {
    paginationHTML = '<div class="pagination-info">Showing all ${currentList.length} items</div>';
  } else {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, currentList.length);
    
    paginationHTML = `
      <div class="pagination-container">
        <div class="pagination-info">
          Showing ${startItem}-${endItem} of ${currentList.length} items
        </div>
        <div class="pagination-controls">
          <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" onclick="changePage(${Math.max(1, currentPage - 1)})" ${currentPage === 1 ? 'disabled' : ''}>
            ← Previous
          </button>
          
          ${renderPageNumbers(currentPage, totalPages)}
          
          <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" onclick="changePage(${Math.min(totalPages, currentPage + 1)})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next →
          </button>
        </div>
      </div>
    `;
  }
  
  paginationEl.innerHTML = paginationHTML;
}

function renderPageNumbers(currentPage, totalPages) {
  let pageNumbers = '';
  
  // Always show first page
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pageNumbers += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
  } else {
    // Show first page
    pageNumbers += `<button class="pagination-btn ${1 === currentPage ? 'active' : ''}" onclick="changePage(1)">1</button>`;
    
    // Show ellipsis if needed
    if (currentPage > 4) {
      pageNumbers += `<span class="pagination-ellipsis">...</span>`;
    }
    
    // Show pages around current page
    const start = Math.max(2, currentPage - 2);
    const end = Math.min(totalPages - 1, currentPage + 2);
    
    for (let i = start; i <= end; i++) {
      if (i > 1 && i < totalPages) {
        pageNumbers += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
      }
    }
    
    // Show ellipsis if needed
    if (currentPage < totalPages - 3) {
      pageNumbers += `<span class="pagination-ellipsis">...</span>`;
    }
    
    // Show last page
    if (totalPages > 1) {
      pageNumbers += `<button class="pagination-btn ${totalPages === currentPage ? 'active' : ''}" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
  }
  
  return pageNumbers;
}

// Global function for pagination
window.changePage = function(page) {
  currentPage = page;
  renderNews(currentList);
};

// handle read more toggles via delegation
document.addEventListener('click', (e) => {
  const t = e.target;
  if (!t.classList) return;
  if (t.classList.contains('toggle-full')) {
    e.preventDefault();
    const art = t.closest('article.item');
    if (!art) return;
    const expanded = art.classList.toggle('expanded');
    const full = art.querySelector('.full-content');
    const summary = art.querySelector('.summary');
    if (expanded) {
      if (full) full.style.display = 'block';
      if (summary) summary.style.display = 'none';
      t.textContent = 'Show less';
    } else {
      if (full) full.style.display = 'none';
      if (summary) summary.style.display = '';
      t.textContent = 'Read more';
    }
  }
});

// Theme switching functionality
function initThemeSwitcher() {
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  
  // Load saved theme preference
  const savedTheme = localStorage.getItem('hkex-theme') || 'default';
  body.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);
  
  // Theme toggle event listener
  themeToggle.addEventListener('click', () => {
    const currentTheme = body.getAttribute('data-theme') || 'default';
    let newTheme;
    
    if (currentTheme === 'default') {
      newTheme = 'dark';
    } else if (currentTheme === 'dark') {
      newTheme = 'vibrant';
    } else {
      newTheme = 'default';
    }
    
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('hkex-theme', newTheme);
    updateThemeButton(newTheme);
    
    // Animate theme change
    document.querySelectorAll('.item').forEach(item => {
      item.style.animation = 'none';
      item.offsetHeight; // Trigger reflow
      item.style.animation = 'themeSwitch 0.5s ease';
    });
  });
}

function updateThemeButton(theme) {
  const themeToggle = document.getElementById('themeToggle');
  if (theme === 'dark') {
    themeToggle.textContent = '🌙 Dark';
    themeToggle.style.background = '#1e1e1e';
    themeToggle.style.color = '#ffffff';
    themeToggle.style.borderColor = '#333333';
  } else if (theme === 'vibrant') {
    themeToggle.textContent = '🎨 Vibrant';
    themeToggle.style.background = '#ffffff';
    themeToggle.style.color = '#f59e0b';
    themeToggle.style.borderColor = '#e2e8f0';
    themeToggle.style.boxShadow = '0 10px 15px -3px rgba(245, 158, 11, 0.3)';
  } else {
    themeToggle.textContent = '🌓 Light';
    themeToggle.style.background = '#ffffff';
    themeToggle.style.color = '#212529';
    themeToggle.style.borderColor = '#e5e6eb';
    themeToggle.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
  }
}

// Add datetime functionality
function updateDateTime() {
  const now = new Date();
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  const dateElement = document.getElementById('currentDate');
  const timeElement = document.getElementById('currentTime');
  
  if (dateElement && timeElement) {
    dateElement.textContent = now.toLocaleDateString('en-HK', options);
    timeElement.textContent = now.toLocaleTimeString('en-HK', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

// Update last auto fetch time
async function updateLastFetchTime() {
  try {
    const response = await fetch('/api/last-fetch-time');
    if (response.ok) {
      const data = await response.json();
      const lastFetchElement = document.getElementById('lastFetchTime');
      
      if (lastFetchElement) {
        if (data.lastAutoFetchTimeFormatted) {
          lastFetchElement.textContent = `Last auto fetch: ${data.lastAutoFetchTimeFormatted}`;
          lastFetchElement.style.display = 'block';
        } else {
          lastFetchElement.textContent = 'Last auto fetch: Never';
          lastFetchElement.style.display = 'block';
        }
      }
    }
  } catch (error) {
    console.error('Error fetching last fetch time:', error);
  }
}

// Update time every second
setInterval(updateDateTime, 1000);

// Update last fetch time every 5 minutes
setInterval(updateLastFetchTime, 300000);

// Initial updates
updateDateTime();
updateLastFetchTime();





// Helper function for text highlighting
function highlightText(text, query) {
  if (!query || !text) return text;
  
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

// Helper function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function updateNewsWithFilters() {
  const presets = Array.from(document.querySelectorAll('#presetsList button'));
  const activePreset = presets.find(b => b.classList.contains('active'))?.textContent || '';
  const q = document.getElementById('search').value;
  
  // Update search query
  currentFilters.searchQuery = q;
  
  let list = await fetchNews(activePreset || null, q || null);
  renderNews(list);
}


async function init() {
  // Initialize theme switching first
  initThemeSwitcher();
  
  const items = await fetchNews();
  
  
  // Populate traditional stock code filter (for backward compatibility)
  const stockCodeSelect = document.getElementById('stockCodeFilter');
  const stockCodes = extractStockCodes(items);
  stockCodes.forEach(code => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = code;
    stockCodeSelect.appendChild(opt);
  });

  const presets = await fetchFilters();
  const presetsList = document.getElementById('presetsList');
  presetsList.innerHTML = '';
  presets.forEach(p => {
    const b = document.createElement('button');
    b.textContent = p.name;
    b.onclick = async () => {
      document.getElementById('search').value = '';
      document.getElementById('stockCodeFilter').value = '';
      const items = await fetchNews(p.name);
      renderNews(items);
    };
    presetsList.appendChild(b);
  });

  // Enhanced update function with all filters
  const updateDisplay = async () => {
    const preset = document.querySelector('#presetsList button:active')?.textContent || '';
    const q = document.getElementById('search').value;
    const stockCode = document.getElementById('stockCodeFilter').value;
    
    // Update search query in filters
    currentFilters.searchQuery = q;
    
    let list = await fetchNews(preset || null, q || null);
    renderNews(list, stockCode);
  };

  document.getElementById('search').addEventListener('input', updateDisplay);
  
  document.getElementById('stockCodeFilter').addEventListener('change', updateDisplay);
  
  document.getElementById('summaryLength').addEventListener('change', () => {
    const q = document.getElementById('search').value;
    const stockCode = document.getElementById('stockCodeFilter').value;
    const presets = Array.from(document.querySelectorAll('#presetsList button'));
    const activePreset = presets.find(b => b.classList.contains('active'))?.textContent || '';
    fetchNews(activePreset || null, q || null).then(list => renderNews(list, stockCode));
  });

  document.getElementById('refresh').addEventListener('click', async () => {
    const btn = document.getElementById('refresh');
    btn.disabled = true;
    btn.textContent = 'Fetching...';
    try {
      await fetch('/api/fetch', { method: 'POST' });
      const newItems = await fetchNews();
      
      // Reset to first page to show latest items
      currentPage = 1;
      
      // Repopulate stock codes in case there are new ones
      const newCodes = extractStockCodes(newItems);
      const currentCodes = Array.from(stockCodeSelect.options).map(o => o.value).slice(1);
      const codes = Array.from(new Set([...currentCodes, ...newCodes])).sort();
      
      stockCodeSelect.innerHTML = '<option value="">All stocks</option>';
      codes.forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        stockCodeSelect.appendChild(opt);
      });
      
      renderNews(newItems);
    } catch (e) {
      alert('Fetch failed: ' + e.message);
    }
    btn.disabled = false;
    btn.textContent = 'Fetch latest';
  });

  // initial load
  renderNews(items);
}

init();