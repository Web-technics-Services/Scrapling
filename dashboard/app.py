import os
import sys
import time
from typing import Dict, List, Optional, Any
from pathlib import Path

# Add project root directory to path if running directly
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl

# Import Scrapling
try:
    from scrapling.fetchers import Fetcher, StealthyFetcher, DynamicFetcher
    from scrapling.parser import Selector
    SCRAPLING_AVAILABLE = True
except ImportError:
    SCRAPLING_AVAILABLE = False

app = FastAPI(
    title="Scrapling Graphical Web Dashboard",
    description="Interactive Web UI and REST API for Scrapling web scraping engine",
    version="1.0.0"
)

# Mount static files
static_dir = BASE_DIR / "static"
static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

# Recent scrape history cache (in-memory)
scrape_history: List[Dict[str, Any]] = []


class SelectorRule(BaseModel):
    name: str
    query: str
    type: str = "css"  # "css" or "xpath"
    attribute: Optional[str] = None  # e.g. "href", "src", "text"
    extract_all: bool = True


class ScrapeRequest(BaseModel):
    url: str
    engine: str = "basic"  # "basic", "stealthy", "dynamic"
    selectors: Optional[List[SelectorRule]] = []
    preset: Optional[str] = None  # "headings", "links", "metadata", "raw_html"
    headless: bool = True
    network_idle: bool = False
    timeout: Optional[int] = 30000


@app.get("/", response_class=HTMLResponse)
async def serve_dashboard():
    """Serve the primary graphical dashboard page."""
    html_file = BASE_DIR / "templates" / "index.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text(encoding="utf-8"))
    return HTMLResponse("<h3>Dashboard template not found. Please verify templates/index.html exists.</h3>")


@app.get("/api/health")
async def health_check():
    """Health check endpoint indicating server and Scrapling engine status."""
    return {
        "status": "healthy",
        "scrapling_ready": SCRAPLING_AVAILABLE,
        "history_count": len(scrape_history),
    }


@app.get("/api/history")
async def get_history():
    """Retrieve list of recent scraping runs."""
    return {"history": list(reversed(scrape_history[-50:]))}


@app.post("/api/scrape")
async def execute_scrape(payload: ScrapeRequest):
    """Execute a web scraping task using Scrapling fetchers and parser."""
    if not SCRAPLING_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="Scrapling library is not installed or importable. Check server environment."
        )

    start_time = time.perf_counter()
    url = str(payload.url).strip()

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        # 1. Fetch the target page using chosen Scrapling Fetcher
        if payload.engine == "stealthy":
            response = StealthyFetcher.fetch(
                url,
                headless=payload.headless,
                network_idle=payload.network_idle,
                timeout=payload.timeout or 30000
            )
        elif payload.engine == "dynamic":
            response = DynamicFetcher.fetch(
                url,
                headless=payload.headless,
                network_idle=payload.network_idle,
                timeout=payload.timeout or 30000
            )
        else:  # "basic" HTTP fetcher
            response = Fetcher.get(url)

        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        status_code = getattr(response, "status", 200)

        # 2. Extract Data based on Presets or Custom Selectors
        extracted_data: Dict[str, Any] = {}

        # Quick preset extractions
        if payload.preset == "headings":
            h1s = [el.text.strip() for el in response.css("h1") if el.text]
            h2s = [el.text.strip() for el in response.css("h2") if el.text]
            h3s = [el.text.strip() for el in response.css("h3") if el.text]
            extracted_data["h1"] = h1s
            extracted_data["h2"] = h2s
            extracted_data["h3"] = h3s

        elif payload.preset == "links":
            links = []
            for a in response.css("a[href]"):
                href = a.attrib.get("href", "")
                text = (a.text or "").strip()
                if href:
                    links.append({"text": text, "url": href})
            extracted_data["links"] = links

        elif payload.preset == "metadata":
            title_node = response.css("title::text").first
            title = title_node if title_node else ""
            meta_desc = response.css('meta[name="description"]::attr(content)').first or ""
            meta_og = response.css('meta[property="og:title"]::attr(content)').first or ""
            extracted_data["title"] = title
            extracted_data["description"] = meta_desc
            extracted_data["og_title"] = meta_og

        # Custom selectors execution
        if payload.selectors:
            for rule in payload.selectors:
                if not rule.query:
                    continue
                
                # Query elements
                if rule.type == "xpath":
                    matches = response.xpath(rule.query)
                else:
                    matches = response.css(rule.query)

                values = []
                for node in matches:
                    val = ""
                    if rule.attribute and rule.attribute != "text":
                        val = node.attrib.get(rule.attribute, "")
                    else:
                        val = (node.text or "").strip()
                    if val:
                        values.append(val)

                if rule.extract_all:
                    extracted_data[rule.name] = values
                else:
                    extracted_data[rule.name] = values[0] if values else None

        # Build response item
        result_record = {
            "id": f"scrape_{int(time.time() * 1000)}",
            "url": url,
            "engine": payload.engine,
            "status_code": status_code,
            "time_ms": elapsed_ms,
            "data": extracted_data,
            "html_preview": getattr(response, "text", "")[:4000],
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        # Save to history
        scrape_history.append(result_record)
        if len(scrape_history) > 100:
            scrape_history.pop(0)

        return result_record

    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        error_record = {
            "id": f"err_{int(time.time() * 1000)}",
            "url": url,
            "engine": payload.engine,
            "status_code": 500,
            "time_ms": elapsed_ms,
            "error": str(exc),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        scrape_history.append(error_record)
        return JSONResponse(status_code=500, content=error_record)
