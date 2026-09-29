// State
let currentResults = null;
let currentView = 'table';

// On page load
document.addEventListener('DOMContentLoaded', () => {
  checkEngineStatus();
  initDefaultSelectors();
  initExtractionModeHandlers();
  loadHistory();
});

// Check API & Scrapling health
async function checkEngineStatus() {
  const badge = document.getElementById('engine-status');
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.scrapling_ready) {
      badge.textContent = 'Engine Ready';
      badge.className = 'status-badge status-ready';
    } else {
      badge.textContent = 'Scrapling Not Installed';
      badge.className = 'status-badge status-error';
    }
  } catch (err) {
    badge.textContent = 'Server Offline';
    badge.className = 'status-badge status-error';
  }
}

// Default custom selectors
function initDefaultSelectors() {
  const container = document.getElementById('selectors-container');
  container.innerHTML = '';
  addSelectorRow('Quote', '.quote span.text', 'text');
  addSelectorRow('Author', '.quote small.author', 'text');
}

function addSelectorRow(name = '', query = '', attr = 'text') {
  const container = document.getElementById('selectors-container');
  const row = document.createElement('div');
  row.className = 'selector-row';
  row.innerHTML = `
    <input type="text" class="field-name" placeholder="Field" value="${name}">
    <input type="text" class="field-query" placeholder="CSS or XPath Selector" value="${query}">
    <select class="field-attr">
      <option value="text" ${attr === 'text' ? 'selected' : ''}>Text</option>
      <option value="href" ${attr === 'href' ? 'selected' : ''}>href</option>
      <option value="src" ${attr === 'src' ? 'selected' : ''}>src</option>
      <option value="title" ${attr === 'title' ? 'selected' : ''}>title</option>
      <option value="content" ${attr === 'content' ? 'selected' : ''}>content</option>
    </select>
    <button type="button" class="btn-remove" onclick="this.parentElement.remove()" title="Remove field">&times;</button>
  `;
  container.appendChild(row);
}

// Extraction mode tabs
function initExtractionModeHandlers() {
  const tabs = document.querySelectorAll('.radio-tab');
  const customSection = document.getElementById('custom-selectors-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const radio = tab.querySelector('input');
      radio.checked = true;

      if (radio.value === 'custom') {
        customSection.classList.remove('hidden');
      } else {
        customSection.classList.add('hidden');
      }
    });
  });
}

// Collect selectors from UI
function getCustomSelectors() {
  const rows = document.querySelectorAll('.selector-row');
  const selectors = [];
  rows.forEach(r => {
    const name = r.querySelector('.field-name').value.trim();
    const query = r.querySelector('.field-query').value.trim();
    const attr = r.querySelector('.field-attr').value;
    if (name && query) {
      selectors.push({
        name: name,
        query: query,
        type: query.startsWith('//') || query.startsWith('(') ? 'xpath' : 'css',
        attribute: attr,
        extract_all: true
      });
    }
  });
  return selectors;
}

// Run scrape execution
async function runScrape() {
  const url = document.getElementById('target-url').value.trim();
  const engine = document.getElementById('engine-select').value;
  const networkIdle = document.getElementById('network-idle').checked;
  const activeModeTab = document.querySelector('.radio-tab.active input').value;

  const scrapeBtn = document.getElementById('scrape-btn');
  const spinner = scrapeBtn.querySelector('.spinner');
  const btnText = scrapeBtn.querySelector('.btn-text');

  // UI state: loading
  setLoading(true);

  const payload = {
    url: url,
    engine: engine,
    network_idle: networkIdle,
    preset: activeModeTab === 'custom' ? null : activeModeTab,
    selectors: activeModeTab === 'custom' ? getCustomSelectors() : []
  };

  try {
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok || data.error) {
      alert(`Scrape error: ${data.error || 'Request failed'}`);
      return;
    }

    currentResults = data;
    renderResults(data);
    loadHistory();
  } catch (err) {
    setLoading(false);
    alert(`Connection error: ${err.message}`);
  }
}

function setLoading(isLoading) {
  const scrapeBtn = document.getElementById('scrape-btn');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const tableView = document.getElementById('table-view');
  const jsonView = document.getElementById('json-view');
  const htmlView = document.getElementById('html-view');

  scrapeBtn.disabled = isLoading;
  if (isLoading) {
    emptyState.classList.add('hidden');
    tableView.classList.add('hidden');
    jsonView.classList.add('hidden');
    htmlView.classList.add('hidden');
    loadingState.classList.remove('hidden');
  } else {
    loadingState.classList.add('hidden');
  }
}

// Render data
function renderResults(res) {
  // Update metrics
  const metricsBar = document.getElementById('metrics-bar');
  const statusBadge = document.getElementById('metric-status');
  const timeBadge = document.getElementById('metric-time');
  const recordsBadge = document.getElementById('metric-records');

  metricsBar.classList.remove('hidden');
  statusBadge.textContent = `${res.status_code} OK`;
  timeBadge.textContent = `${res.time_ms} ms`;

  // Enable exports
  document.getElementById('btn-export-json').disabled = false;
  document.getElementById('btn-export-csv').disabled = false;

  // JSON view
  document.getElementById('json-display').textContent = JSON.stringify(res.data, null, 2);

  // HTML view
  document.getElementById('html-display').textContent = res.html_preview || 'No HTML preview available.';

  // Table view
  renderTable(res.data);

  // Switch to current view
  switchView(currentView);
}

function renderTable(data) {
  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const keys = Object.keys(data);
  if (keys.length === 0) {
    tbody.innerHTML = '<tr><td colspan="100%">No extracted records found.</td></tr>';
    document.getElementById('metric-records').textContent = '0 items';
    return;
  }

  // Determine if columns are arrays
  let maxRows = 1;
  keys.forEach(k => {
    if (Array.isArray(data[k])) {
      if (data[k].length > maxRows) maxRows = data[k].length;
    }
  });

  document.getElementById('metric-records').textContent = `${maxRows} items`;

  // Headers
  const trHead = document.createElement('tr');
  const indexTh = document.createElement('th');
  indexTh.textContent = '#';
  trHead.appendChild(indexTh);

  keys.forEach(k => {
    const th = document.createElement('th');
    th.textContent = k;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);

  // Rows
  for (let i = 0; i < maxRows; i++) {
    const tr = document.createElement('tr');
    const indexTd = document.createElement('td');
    indexTd.textContent = i + 1;
    tr.appendChild(indexTd);

    keys.forEach(k => {
      const td = document.createElement('td');
      const val = data[k];
      if (Array.isArray(val)) {
        const item = val[i];
        if (typeof item === 'object' && item !== null) {
          td.textContent = JSON.stringify(item);
        } else {
          td.textContent = item !== undefined ? item : '';
        }
      } else {
        td.textContent = i === 0 ? val : '';
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
}

// Switch between views: table, json, html
function switchView(view) {
  currentView = view;
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-view') === view));

  const emptyState = document.getElementById('empty-state');
  const tableView = document.getElementById('table-view');
  const jsonView = document.getElementById('json-view');
  const htmlView = document.getElementById('html-view');

  if (!currentResults) {
    emptyState.classList.remove('hidden');
    tableView.classList.add('hidden');
    jsonView.classList.add('hidden');
    htmlView.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tableView.classList.toggle('hidden', view !== 'table');
  jsonView.classList.toggle('hidden', view !== 'json');
  htmlView.classList.toggle('hidden', view !== 'html');
}

// Copy JSON
function copyJson() {
  if (!currentResults) return;
  navigator.clipboard.writeText(JSON.stringify(currentResults.data, null, 2))
    .then(() => alert('JSON copied to clipboard!'))
    .catch(err => alert('Failed to copy: ' + err));
}

// Export files
function exportData(format) {
  if (!currentResults || !currentResults.data) return;

  const filename = `scrape_${Date.now()}.${format}`;
  let content = '';
  let mimeType = '';

  if (format === 'json') {
    content = JSON.stringify(currentResults.data, null, 2);
    mimeType = 'application/json';
  } else if (format === 'csv') {
    content = convertToCSV(currentResults.data);
    mimeType = 'text/csv';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function convertToCSV(data) {
  const keys = Object.keys(data);
  if (keys.length === 0) return '';

  let maxRows = 1;
  keys.forEach(k => {
    if (Array.isArray(data[k]) && data[k].length > maxRows) {
      maxRows = data[k].length;
    }
  });

  const headerLine = keys.map(k => `"${k}"`).join(',');
  const lines = [headerLine];

  for (let i = 0; i < maxRows; i++) {
    const row = keys.map(k => {
      const val = data[k];
      let cell = '';
      if (Array.isArray(val)) {
        cell = val[i] !== undefined ? String(val[i]) : '';
      } else {
        cell = i === 0 ? String(val) : '';
      }
      return `"${cell.replace(/"/g, '""')}"`;
    });
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

// History loader
async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    const container = document.getElementById('history-container');
    container.innerHTML = '';

    if (!data.history || data.history.length === 0) {
      container.innerHTML = '<p class="history-empty">No recent scraping runs yet.</p>';
      return;
    }

    data.history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <span class="history-url">${item.url}</span>
        <div class="history-meta">
          <span class="badge ${item.status_code === 200 ? 'badge-success' : 'badge-secondary'}">${item.status_code || 500}</span>
          <span>${item.engine}</span>
          <span>${item.time_ms || 0} ms</span>
          <span>${item.timestamp}</span>
        </div>
      `;
      div.addEventListener('click', () => {
        currentResults = item;
        document.getElementById('target-url').value = item.url;
        document.getElementById('engine-select').value = item.engine || 'basic';
        renderResults(item);
      });
      container.appendChild(div);
    });
  } catch (err) {
    console.error('History load error:', err);
  }
}
