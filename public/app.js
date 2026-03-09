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
    code = code || item.stockCode || item.stock_code || item.code || '';
    if (code) codes.add(String(code).trim());
  });
  return Array.from(codes).sort();
}

function fmtDate(item) {
  const cand = item.relTime || item.pubTime || item.publishTime || item.publish_date || item.date || item.time || item.timestamp || item.postTime;
  if (!cand) return '';
  const d = new Date(cand);
  if (isNaN(d.getTime())) return String(cand);
  return d.toLocaleString();
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
  dateStart: null,
  dateEnd: null,
  newsTypes: [],
  searchQuery: '',
  stockCodes: []  // Array for multi-select
};

function renderNews(list) {
  const el = document.getElementById('newsList');
  const paginationEl = document.getElementById('pagination');
  
  // Apply all filters
  let filtered = list;
  
  // Apply stock codes filter (multiple)
  if (currentFilters.stockCodes && currentFilters.stockCodes.length > 0) {
    filtered = filtered.filter(item => {
      let code = '';
      if (Array.isArray(item.stock) && item.stock.length) {
        code = item.stock[0].sc || item.stock[0].code || '';
      }
      code = code || item.stockCode || item.stock_code || item.code || '';
      return currentFilters.stockCodes.includes(String(code).trim());
    });
  }
  
  // Apply date range filter
  if (currentFilters.dateStart || currentFilters.dateEnd) {
    filtered = filtered.filter(item => {
      const dateStr = item.relTime || item.pubTime || item.publishTime || item.publish_date || item.date || item.time || item.timestamp || item.postTime;
      if (!dateStr) return true;
      
      const itemDate = new Date(dateStr);
      if (isNaN(itemDate.getTime())) return true;
      
      let include = true;
      if (currentFilters.dateStart) {
        include = include && itemDate >= currentFilters.dateStart;
      }
      if (currentFilters.dateEnd) {
        include = include && itemDate <= currentFilters.dateEnd;
      }
      
      return include;
    });
  }
  
  // Apply news type filter
  if (currentFilters.newsTypes.length > 0) {
    filtered = filtered.filter(item => {
      const newsType = detectNewsType(item);
      return currentFilters.newsTypes.includes(newsType);
    });
  }
  
  // Apply search query filter
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
      code = code || pick([n.stockCode, n.stock_code, n.stockCd, n.code, n.ticker, n.shortCode]) || '';
      name = name || pick([n.stockName, n.stock_name, n.company, n.issuer, n.companyName, n.issuerName]) || '';
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

// Date range filter functionality
function initDateFilterDropdown() {
  const dropdown = document.getElementById('dateFilterDropdown');
  const selected = document.getElementById('dateFilterSelected');
  const options = document.getElementById('dateFilterOptions');
  const presetButtons = document.querySelectorAll('.date-preset-btn');
  const dateRangeInputs = document.getElementById('dateRangeInputs');
  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const applyDateRange = document.getElementById('applyDateRange');
  const clearDateRange = document.getElementById('clearDateRange');

  // Toggle dropdown
  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    options.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      options.style.display = 'none';
    }
  });

  // Date preset buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.dataset.range;
      const today = new Date();
      let start = null;
      let end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      if (range === 'today') {
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      } else if (range === 'this-week') {
        const day = today.getDay();
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day);
      } else if (range === 'this-month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
      } else if (range === 'custom') {
        dateRangeInputs.style.display = 'block';
        return;
      }

      currentFilters.dateStart = start;
      currentFilters.dateEnd = end;
      selected.textContent = btn.textContent;
      dropdown.classList.remove('open');
      options.style.display = 'none';
      updateNewsWithFilters();
    });
  });

  // Apply custom date range
  applyDateRange.addEventListener('click', () => {
    const start = dateStart.value ? new Date(dateStart.value) : null;
    const end = dateEnd.value ? new Date(dateEnd.value) : null;
    
    if (start && end && start > end) {
      alert('Start date must be before end date');
      return;
    }

    currentFilters.dateStart = start;
    currentFilters.dateEnd = end;
    selected.textContent = 'Custom range';
    dropdown.classList.remove('open');
    options.style.display = 'none';
    dateRangeInputs.style.display = 'none';
    updateNewsWithFilters();
  });

  // Clear date range
  clearDateRange.addEventListener('click', () => {
    currentFilters.dateStart = null;
    currentFilters.dateEnd = null;
    selected.textContent = 'All dates';
    dateStart.value = '';
    dateEnd.value = '';
    dropdown.classList.remove('open');
    options.style.display = 'none';
    dateRangeInputs.style.display = 'none';
    updateNewsWithFilters();
  });
}

// News type filter functionality
async function initNewsTypeFilterDropdown() {
  const dropdown = document.getElementById('newsTypeFilterDropdown');
  const selected = document.getElementById('newsTypeFilterSelected');
  const options = document.getElementById('newsTypeFilterOptions');
  const newsTypeList = document.getElementById('newsTypeList');
  const selectNewsTypes = document.getElementById('selectNewsTypes');
  const clearNewsTypes = document.getElementById('clearNewsTypes');

  try {
    const response = await fetch('/api/news/types');
    const newsTypes = await response.json();
    
    // Populate news types
    newsTypes.forEach(type => {
      const checkbox = document.createElement('div');
      checkbox.className = 'news-type-checkbox';
      checkbox.innerHTML = `
        <input type="checkbox" id="news-type-${type.replace(/\s+/g, '-').toLowerCase()}" value="${type}">
        <label for="news-type-${type.replace(/\s+/g, '-').toLowerCase()}">${type}</label>
      `;
      newsTypeList.appendChild(checkbox);
    });
  } catch (error) {
    console.error('Error fetching news types:', error);
  }

  // Toggle dropdown
  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    options.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      options.style.display = 'none';
    }
  });

  // Select news types
  selectNewsTypes.addEventListener('click', () => {
    const checkboxes = newsTypeList.querySelectorAll('input[type="checkbox"]');
    const selectedTypes = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    currentFilters.newsTypes = selectedTypes;
    selected.textContent = selectedTypes.length > 0 
      ? `${selectedTypes.length} type${selectedTypes.length > 1 ? 's' : ''}` 
      : 'All types';
    dropdown.classList.remove('open');
    options.style.display = 'none';
    updateNewsWithFilters();
  });

  // Clear news types
  clearNewsTypes.addEventListener('click', () => {
    const checkboxes = newsTypeList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    currentFilters.newsTypes = [];
    selected.textContent = 'All types';
    dropdown.classList.remove('open');
    options.style.display = 'none';
    updateNewsWithFilters();
  });
}

// Enhanced renderNews function with all filters
function renderNews(list) {
  const el = document.getElementById('newsList');
  const paginationEl = document.getElementById('pagination');
  
  // Apply all filters
  let filtered = list;
  
  // Apply stock codes filter (multiple)
  if (currentFilters.stockCodes && currentFilters.stockCodes.length > 0) {
    filtered = filtered.filter(item => {
      let code = '';
      if (Array.isArray(item.stock) && item.stock.length) {
        code = item.stock[0].sc || item.stock[0].code || '';
      }
      code = code || item.stockCode || item.stock_code || item.code || '';
      return currentFilters.stockCodes.includes(String(code).trim());
    });
  }
  
  // Apply date range filter
  if (currentFilters.dateStart || currentFilters.dateEnd) {
    filtered = filtered.filter(item => {
      const dateStr = item.relTime || item.pubTime || item.publishTime || item.publish_date || item.date || item.time || item.timestamp || item.postTime;
      if (!dateStr) return true;
      
      const itemDate = new Date(dateStr);
      if (isNaN(itemDate.getTime())) return true;
      
      let include = true;
      if (currentFilters.dateStart) {
        include = include && itemDate >= currentFilters.dateStart;
      }
      if (currentFilters.dateEnd) {
        include = include && itemDate <= currentFilters.dateEnd;
      }
      
      return include;
    });
  }
  
  // Apply news type filter
  if (currentFilters.newsTypes.length > 0) {
    filtered = filtered.filter(item => {
      const newsType = detectNewsType(item);
      return currentFilters.newsTypes.includes(newsType);
    });
  }
  
  // Apply search query filter
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
      code = code || pick([n.stockCode, n.stock_code, n.stockCd, n.code, n.ticker, n.shortCode]) || '';
      name = name || pick([n.stockName, n.stock_name, n.company, n.issuer, n.companyName, n.issuerName]) || '';
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

// Helper function to detect news type (same as backend)
function detectNewsType(item) {
  const text = ((item.title || '') + ' ' + (item.content || '') + ' ' + (item.summary || '')).toLowerCase();
  
  if (text.includes('financial results') || text.includes('earnings') || text.includes('revenue') || text.includes('profit') || text.includes('loss')) {
    return 'Financial Results';
  }
  
  if (text.includes('dividend') || text.includes('share split') || text.includes('bonus issue') || text.includes('rights issue') || text.includes('capital increase')) {
    return 'Corporate Actions';
  }
  
  if (text.includes('trading update') || text.includes('business update') || text.includes('operating performance')) {
    return 'Trading Updates';
  }
  
  if (text.includes('annual report') || text.includes('interim report') || text.includes('quarterly report') || text.includes('form')) {
    return 'Regulatory Filings';
  }
  
  if (text.includes('announcement') || text.includes('notice') || text.includes('corporate information')) {
    return 'General Announcements';
  }
  
  return 'Other';
}

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

// Update news with all filters
async function updateNewsWithFilters() {
  const presets = Array.from(document.querySelectorAll('#presetsList button'));
  const activePreset = presets.find(b => b.classList.contains('active'))?.textContent || '';
  const q = document.getElementById('search').value;
  
  // Update search query
  currentFilters.searchQuery = q;
  
  let list = await fetchNews(activePreset || null, q || null);
  renderNews(list);
}

// Stock filter dropdown functionality
function initStockFilterDropdown(items) {
  const dropdown = document.getElementById('stockFilterDropdown');
  const selected = document.getElementById('stockFilterSelected');
  const options = document.getElementById('stockFilterOptions');
  const searchInput = document.getElementById('stockFilterSearch');
  const list = document.getElementById('stockFilterList');
  const selectBtn = document.getElementById('selectStocks');
  const clearBtn = document.getElementById('clearStocks');
  
  let allStockCheckboxes = [];

  // Populate dropdown with stock checkboxes
  function populateStockFilter(items) {
    list.innerHTML = ''; // Clear existing

    // Extract unique stock codes and names
    const stockMap = new Map();
    items.forEach(item => {
      let code = '';
      let name = '';
      if (Array.isArray(item.stock) && item.stock.length) {
        code = item.stock[0].sc || item.stock[0].code || '';
        name = item.stock[0].sn || item.stock[0].name || '';
      }
      code = code || pick([item.stockCode, item.stock_code, item.stockCd, item.code, item.ticker, item.shortCode]) || '';
      name = name || pick([item.stockName, item.stock_name, item.company, item.issuer, item.companyName, item.issuerName]) || '';
      
      if (code) {
        stockMap.set(code, name);
      }
    });

    // Create checkboxes sorted by stock code
    const sortedStocks = Array.from(stockMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    sortedStocks.forEach(([code, name]) => {
      const checkbox = document.createElement('div');
      checkbox.className = 'stock-filter-checkbox';
      checkbox.innerHTML = `
        <input type="checkbox" id="stock-${code}" value="${code}">
        <label for="stock-${code}">
          <span class="stock-code">${code}</span> - <span class="stock-name">${name}</span>
        </label>
      `;
      list.appendChild(checkbox);
    });

    allStockCheckboxes = Array.from(list.querySelectorAll('input[type="checkbox"]'));
  }

  // Toggle dropdown
  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    options.style.display = dropdown.classList.contains('open') ? 'block' : 'none';
    if (dropdown.classList.contains('open')) {
      searchInput.focus();
      searchInput.select();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      options.style.display = 'none';
    }
  });

  // Search functionality
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    filterStockOptions(query);
  });

  // Filter options based on search query
  function filterStockOptions(query) {
    const checkboxes = list.querySelectorAll('.stock-filter-checkbox');
    
    checkboxes.forEach(checkbox => {
      const code = checkbox.querySelector('input').value;
      const name = checkbox.querySelector('.stock-name')?.textContent || '';
      const text = `${code} ${name}`.toLowerCase();
      
      checkbox.style.display = query ? (text.includes(query) ? 'flex' : 'none') : 'flex';
    });
  }

  // Apply selected stocks
  selectBtn.addEventListener('click', () => {
    const selectedCodes = allStockCheckboxes
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    
    currentFilters.stockCodes = selectedCodes;
    selected.textContent = selectedCodes.length > 0 
      ? `${selectedCodes.length} stock${selectedCodes.length > 1 ? 's' : ''} selected`
      : 'All stocks';
    
    dropdown.classList.remove('open');
    options.style.display = 'none';
    updateNewsWithFilters();
  });

  // Clear selection
  clearBtn.addEventListener('click', () => {
    allStockCheckboxes.forEach(cb => cb.checked = false);
    currentFilters.stockCodes = [];
    selected.textContent = 'All stocks';
    dropdown.classList.remove('open');
    options.style.display = 'none';
    updateNewsWithFilters();
  });

  // Initialize
  populateStockFilter(items);
}

async function init() {
  // Initialize theme switching first
  initThemeSwitcher();
  
  const items = await fetchNews();
  
  // Initialize all filter dropdowns
  initDateFilterDropdown();
  await initNewsTypeFilterDropdown();
  initStockFilterDropdown(items);
  
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