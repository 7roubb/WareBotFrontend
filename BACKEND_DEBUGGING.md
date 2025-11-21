# Backend Debugging Guide

## Issue: 500 Internal Server Error on Dashboard Endpoints

The frontend is receiving **500 Internal Server Error** responses from these endpoints:
- `/api/dashboard/shelves`
- `/api/dashboard/top-moving` 
- `/api/dashboard/daily`

This means **the backend code is crashing** when processing these requests.

## Diagnostic Steps

### 1. Check Backend Server Status
```bash
# Make sure the backend Flask server is running
python app.py
# or
python -m flask run
```

**Expected output:**
```
 * Serving Flask app 'app'
 * Running on http://localhost:5000
```

### 2. Check Backend Logs
Monitor the Flask server terminal for error messages when you try to load the dashboard. You should see a Python traceback indicating what's failing.

### 3. Use Frontend Diagnostics Page
The frontend now includes a diagnostics page to test all endpoints:

**Via App Menu:**
- This would need to be added to the navigation (see below)

**Via Console:**
```javascript
// Open browser console (F12) and run:
import { health } from './src/services/api.ts';
health.check().then(r => console.log(r));
health.testDashboard().then(r => console.log(r));
```

### 4. Test Endpoints Directly
Use `curl` to test each endpoint:

```bash
# Test top-moving
curl http://localhost:5000/api/dashboard/top-moving

# Test shelves
curl http://localhost:5000/api/dashboard/shelves

# Test daily
curl http://localhost:5000/api/dashboard/daily
```

## Common Backend Issues

### Issue 1: Database Connection Failing
**Symptom:** 500 errors on all endpoints
**Fix:** Check that MongoDB is running
```bash
# Check MongoDB status
mongod --version
# If not running, start it
```

### Issue 2: Collection Not Found
**Symptom:** 500 errors mentioning collection doesn't exist
**Fix:** Make sure the database has been initialized with sample data

### Issue 3: Missing Fields in Data
**Symptom:** 500 errors when accessing data fields
**Fix:** Check that all products/robots/shelves have the expected fields

### Issue 4: Import Errors
**Symptom:** Module not found errors in Flask logs
**Fix:** Check that all Flask dependencies are installed
```bash
pip install -r requirements.txt
```

## Frontend Error Display

The frontend now shows helpful error messages including:
- HTTP status code
- Error message from backend (if available)
- Suggestion to check if backend is running

**To enable detailed debug output:**
In `src/services/api.ts`, set:
```typescript
const DEBUG_MODE = true;
```

This will log full error responses to the browser console.

## Backend Code to Fix

These Flask routes need to be investigated in your `routes.py`:

```python
@api_bp.route("/dashboard/top-moving", methods=["GET"])
def dashboard_top_route():
    return jsonify(dashboard_top_moving_products())  # Check this function

@api_bp.route("/dashboard/shelves", methods=["GET"])
def dashboard_shelves_route():
    return jsonify(dashboard_shelf_summary())  # Check this function

@api_bp.route("/dashboard/daily", methods=["GET"])
def dashboard_daily_route():
    return jsonify(dashboard_daily_movements())  # Check this function
```

Make sure these functions:
1. Connect to the database successfully
2. Return valid data structures
3. Handle empty collections gracefully
4. Don't have typos in collection/field names

## Quick Checklist

- [ ] Flask server running on port 5000
- [ ] MongoDB running
- [ ] No Python errors in Flask logs
- [ ] Database collections exist
- [ ] All required fields present in documents
- [ ] API returns valid JSON for test endpoints
- [ ] Frontend can reach backend (check Network tab in DevTools)

## Contact Points

If you need to debug further:
1. Check Flask server console for the exact error
2. Use browser DevTools Network tab to see response body
3. Enable DEBUG_MODE in frontend for detailed logging
4. Verify database data with MongoDB client
