# Quick Start Guide

## The Problem

The frontend is showing errors because the **Flask backend server is not running**.

## Solution: Start the Backend Server

### Step 1: Open a new terminal
```bash
cd /home/super/Desktop/warebot-backend
```

### Step 2: Start the Flask server
```bash
python main.py
```

### Expected Output
You should see:
```
WARNING: This is a development server. Do not use it in production.
Running on http://localhost:5000
```

### Step 3: The frontend will auto-reconnect
- Once the backend is running, the dashboard will automatically show real data
- The yellow "Backend Server Not Connected" banner will disappear
- All API calls will work properly

---

## What's Running Where

| Service | Port | Status |
|---------|------|--------|
| Frontend (Vite) | 5174 | ✓ Running |
| Backend (Flask) | 5000 | ❌ Needs to be started |
| MongoDB | 27017 | ✓ Running (assumed) |

---

## Troubleshooting

### Still seeing "Backend Server Not Connected"?

1. **Check Flask is running:**
   ```bash
   curl http://localhost:5000/api/dashboard/shelves
   ```
   Should return JSON, not a connection error.

2. **Check Flask logs:**
   Look for errors in the terminal where you ran `python main.py`

3. **Restart Vite frontend:**
   If Vite dev server restarted, it may need to reload the browser.

### Getting 500 errors on specific endpoints?

This is a backend code issue. See `BACKEND_FIX_GUIDE.md` and `BACKEND_ANALYSIS.md` for details on fixing the `KeyError: 'id'` issue in the dashboard functions.

---

## Frontend Features (Auto-fallback)

The frontend is smart and handles backend downtime gracefully:
- ✓ Shows helpful status banners when backend is disconnected
- ✓ Uses fallback mock data so the app doesn't crash
- ✓ Auto-retries every 10 seconds on Dashboard
- ✓ Auto-retries every 5 seconds on Robots page

Just start the backend server and everything will work!
