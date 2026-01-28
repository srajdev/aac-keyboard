#!/bin/bash
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Run the server
uvicorn server.main:app --host 0.0.0.0 --port 3000 --reload
