#!/bin/bash
echo "Starting Stitch Dashboard..."

# Function to clean up background processes on exit
cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID
    exit
}

# Trap the SIGINT (Ctrl+C) signal to run the cleanup function
trap cleanup SIGINT SIGTERM

echo "Starting Python Backend..."
cd "$(dirname "$0")/backend"

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Run backend in the background
python3 main.py &
BACKEND_PID=$!

echo "Starting React Native Frontend..."
cd ../frontend
npm start

# Wait for frontend process to finish (which happens when you exit Expo)
wait
