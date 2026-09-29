#!/usr/bin/env python3
"""
Dashboard server runner script.
Starts the FastAPI web server to host the graphical UI and API endpoints.
"""
import argparse
import sys
from pathlib import Path

# Ensure dashboard directory and parent directory are on path
DASHBOARD_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DASHBOARD_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(DASHBOARD_DIR) not in sys.path:
    sys.path.insert(0, str(DASHBOARD_DIR))

try:
    import uvicorn
except ImportError:
    print("\n[!] 'uvicorn' is required to run the web dashboard server.")
    print("    Install requirements with: pip install -r dashboard/requirements.txt\n")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Run Scrapling Graphical Web Dashboard")
    parser.add_argument("--host", default="0.0.0.0", help="Host IP to bind (default: 0.0.0.0 for public access)")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")

    args = parser.parse_args()

    print("\n=======================================================")
    print("        🕷️  SCRAPLING GRAPHICAL WEB DASHBOARD           ")
    print("=======================================================")
    print(f"[*] Dashboard URL: http://{args.host}:{args.port}")
    print(f"[*] API Swagger docs: http://{args.host}:{args.port}/docs")
    print(f"[*] Local access:  http://localhost:{args.port}")
    print("=======================================================\n")

    uvicorn.run("app:app", host=args.host, port=args.port, reload=args.reload, app_dir=str(DASHBOARD_DIR))


if __name__ == "__main__":
    main()
