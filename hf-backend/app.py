import os
import sys

# Ensure backend directory is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(current_dir, ".."))
backend_dir = os.path.join(parent_dir, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from backend.main import app
except ImportError:
    try:
        from main import app
    except ImportError:
        import importlib
        main_mod = importlib.import_module("main")
        app = main_mod.app

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "7860"))
    print(f"Starting NoteCraft FastAPI Backend on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
