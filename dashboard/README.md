# Scrapling Graphical Web Dashboard

A web interface and REST API built on top of Scrapling, enabling visual web scraping, anti-bot bypass, custom CSS/XPath extraction, and one-click data export.

---

## Why didn't Scrapling show HTML pages before?
Scrapling is an adaptive web scraping library designed to extract data from *other* websites. It does not contain frontend HTML pages by default. This dashboard provides the graphical web UI layer you can host on your server.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
On your server terminal, navigate to the Scrapling project directory and install the required packages:

```bash
# Install core Scrapling library
pip install -e .

# Install dashboard requirements (FastAPI, Uvicorn)
pip install -r dashboard/requirements.txt
```

*(Optional) If you want to use Playwright browsers for Cloudflare bypass:*
```bash
playwright install-deps chromium
playwright install chromium
```

---

### 2. Start the Web Dashboard
Run the provided runner script:

```bash
python dashboard/run.py
```

By default, the server binds to `0.0.0.0:8000`. You can change the port or host:

```bash
python dashboard/run.py --port 8080 --host 0.0.0.0
```

---

### 3. Open in Your Browser
- From your local machine / browser: visit `http://localhost:8000`
- From a remote server: visit `http://YOUR_SERVER_IP:8000` (ensure port `8000` is allowed in your server's firewall/security group)
- Interactive OpenAPI docs: `http://YOUR_SERVER_IP:8000/docs`

---

## 🛠️ Features
- **3 Scraping Engines**:
  - `Basic HTTP Fetcher`: Ultra-fast, lightweight for standard static pages.
  - `Stealthy Fetcher`: Automatically bypasses Cloudflare Turnstile and anti-bot systems.
  - `Dynamic Fetcher`: Headless browser with full JavaScript rendering.
- **Visual Selector Builder**: Add and customize CSS/XPath selectors and pick attributes (`text`, `href`, `src`, etc.).
- **Quick Presets**: Extract page headings, all links, or SEO meta tags with one click.
- **Live Results Viewer**: View extracted data in an interactive table, pretty-printed JSON, or inspect the raw HTML snippet.
- **One-Click Export**: Download results directly to `JSON` or `CSV`.
- **Scrape History**: Quick access to recent scraping runs and execution metrics.

---

## 🔒 Running as a Background Service on Server (Linux / VPS)

To keep the dashboard running continuously in the background after closing the terminal:

### Option A: Using `nohup` (Simplest)
```bash
nohup python dashboard/run.py --host 0.0.0.0 --port 8000 > dashboard.log 2>&1 &
```

### Option B: Using Systemd Service
Create a service file at `/etc/systemd/system/scrapling-dashboard.service`:

```ini
[Unit]
Description=Scrapling Web Dashboard
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/path/to/Scrapling
ExecStart=/usr/bin/python3 dashboard/run.py --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable scrapling-dashboard
sudo systemctl start scrapling-dashboard
```
