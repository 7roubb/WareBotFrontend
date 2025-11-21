# Backend Services Fix - Step-by-Step Implementation

## Overview

This guide walks through fixing the critical bugs in `services.py` without requiring you to understand the entire file.

---

## Step 1: Find the dashboard_shelf_summary() Function

**Location:** `services.py` (likely around line 200-250)

**What to look for:**
```python
def dashboard_shelf_summary():
    db = get_db()
    shelves = list(db.shelves.find())
    
    # Your code here - look for anything with s['id']
```

**What you're searching for:** Any line that looks like:
```python
s['id']          # ❌ WRONG - causes KeyError
s.get('id')      # ❌ WRONG - returns None
s['_id']         # ❌ WRONG - returns MongoDB ObjectId, needs conversion
```

---

## Step 2: Fix dashboard_shelf_summary()

### Current Code (Broken)
```python
def dashboard_shelf_summary():
    db = get_db()
    shelves = list(db.shelves.find())
    
    result = []
    for s in shelves:
        result.append({
            "id": s['id'],                    # ❌ CRASHES HERE - KeyError: 'id'
            "shelf_id": s['shelf_id'],
            "coords": [s['x_coord'], s['y_coord']],
            "level": s['level'],
            "products": s['product_count'],
            "total_items": s['total_items']
        })
    
    return result
```

### Fixed Code
```python
def dashboard_shelf_summary():
    db = get_db()
    shelves = list(db.shelves.find({"deleted": False}))
    
    result = []
    for s in shelves:
        result.append({
            "shelf_id": s.get('shelf_id', str(s['_id'])),    # ✅ FIXED - use shelf_id or convert _id
            "coords": [
                s.get('x_coord', 0),                          # ✅ Safe with default
                s.get('y_coord', 0)                           # ✅ Safe with default
            ],
            "level": s.get('level', 1),                       # ✅ Safe with default
            "products": s.get('product_count', 0),            # ✅ Safe with default
            "total_items": s.get('total_items', 0),           # ✅ Safe with default
            "warehouse": s.get('warehouse', 'default'),
            "status": s.get('status', 'active')
        })
    
    return result
```

**Changes Made:**
1. Removed the line with `s['id']` completely - NOT needed
2. Changed all `s['field']` to `s.get('field', default_value)`
3. Added `{"deleted": False}` to exclude deleted shelves
4. Added missing fields: warehouse, status

---

## Step 3: Fix dashboard_top_moving_products()

### Find the function:
```python
def dashboard_top_moving_products():
```

### Pattern to look for:
Any of these patterns = BUG:
```python
p['id']          # ❌ WRONG
p['_id']         # ❌ WRONG without str() conversion
result['id']     # ❌ WRONG
```

### Fix pattern:
Replace with this safe pattern:
```python
"product_id": p.get('product_id', str(p['_id'])),  # ✅ CORRECT
```

### Sample Correct Implementation:
```python
def dashboard_top_moving_products():
    """Get top 5 most moved products this month"""
    db = get_db()
    
    # Aggregate transactions for the month
    pipeline = [
        {
            "$match": {
                "timestamp": {
                    "$gte": datetime.now() - timedelta(days=30)
                }
            }
        },
        {
            "$group": {
                "_id": "$product_id",
                "total_moved": {"$sum": "$quantity"},
                "transaction_count": {"$sum": 1}
            }
        },
        {"$sort": {"total_moved": -1}},
        {"$limit": 5}
    ]
    
    transactions = list(db.product_transactions.aggregate(pipeline))
    
    result = []
    for t in transactions:
        product = db.products.find_one({"product_id": t['_id'], "deleted": False})
        if product:
            result.append({
                "product_id": product.get('product_id', str(product['_id'])),  # ✅ FIXED
                "name": product.get('name', 'Unknown'),
                "sku": product.get('sku', ''),
                "units_moved": t.get('total_moved', 0),
                "transaction_count": t.get('transaction_count', 0),
                "current_qty": product.get('quantity', 0)
            })
    
    return result
```

**Key Points:**
- Use `.get()` everywhere
- Always provide a default value
- Convert `_id` with `str(p['_id'])`

---

## Step 4: Fix dashboard_daily_movements()

### Fix pattern - same as above:
```python
"id": str(doc['_id']),  # ✅ CORRECT - convert to string

# NOT:
"id": doc['id'],        # ❌ WRONG
```

### Sample Correct Implementation:
```python
def dashboard_daily_movements():
    """Get last 24 hours of product movements"""
    db = get_db()
    
    # Find all transactions in last 24 hours
    since = datetime.now() - timedelta(hours=24)
    transactions = list(
        db.product_transactions.find({
            "timestamp": {"$gte": since},
            "deleted": False
        }).sort("timestamp", -1)
    )
    
    # Group by transaction type
    movements = {
        "picks": 0,
        "returns": 0,
        "adjustments": 0,
        "total_units": 0,
        "transactions": []
    }
    
    for t in transactions:
        movements["total_units"] += t.get('quantity', 0)
        
        tx_type = t.get('transaction_type', 'unknown')
        if tx_type == 'pick':
            movements["picks"] += t.get('quantity', 0)
        elif tx_type == 'return':
            movements["returns"] += t.get('quantity', 0)
        elif tx_type == 'adjust':
            movements["adjustments"] += t.get('quantity', 0)
        
        # Add transaction record with safe id conversion
        movements["transactions"].append({
            "id": str(t['_id']),                           # ✅ FIXED
            "product_id": t.get('product_id', 'unknown'),
            "type": tx_type,
            "quantity": t.get('quantity', 0),
            "timestamp": t.get('timestamp', '').isoformat() if hasattr(t.get('timestamp', ''), 'isoformat') else str(t.get('timestamp', ''))
        })
    
    return movements
```

---

## Step 5: Check for Similar Issues in Other Functions

### Search for these patterns:
```bash
grep -n "s\['id'\]" services.py
grep -n "p\['id'\]" services.py
grep -n "r\['id'\]" services.py
grep -n "\['id'\]" services.py
```

**If found:** Replace with safe pattern
```python
.get('field_id', str(obj['_id']))  # ✅ CORRECT
```

---

## Step 6: Fix Robot Update Issue in routes.py

**Location:** Around line 200-220

**Current code:**
```python
@api_bp.route("/robots/<id>", methods=["PUT"])
@admin_required
def update_robot_route(id):
    try:
        data = RobotUpdate(**request.json).dict(exclude_none=True)
    except ValidationError as e:
        return handle_validation_error(e)

    updated = update_robot(id, data)

    # ⚠️ BUG: What if updated is None?
    if "robot_id" in data:
        new_topic = updated["topic"]  # ← CRASHES if updated is None
        mqtt_client = current_app.mqtt
        if mqtt_client:
            mqtt_client.subscribe(new_topic)
            current_app.logger.info(f"[MQTT] Resubscribed to {new_topic}")

    return jsonify(updated) if updated else ({"error": "not_found"}, 404)
```

**Fixed code:**
```python
@api_bp.route("/robots/<id>", methods=["PUT"])
@admin_required
def update_robot_route(id):
    try:
        data = RobotUpdate(**request.json).dict(exclude_none=True)
    except ValidationError as e:
        return handle_validation_error(e)

    updated = update_robot(id, data)
    
    if not updated:  # ✅ ADDED - check if robot exists
        return {"error": "not_found"}, 404

    # If robot_id is changed → resubscribe
    if "robot_id" in data:
        new_topic = updated["topic"]  # ✅ SAFE NOW - checked above
        mqtt_client = current_app.mqtt
        if mqtt_client:
            mqtt_client.subscribe(new_topic)
            current_app.logger.info(f"[MQTT] Resubscribed to {new_topic}")

    return jsonify(updated)
```

**What changed:**
- Added `if not updated: return ...` before trying to access `updated["topic"]`

---

## Step 7: Create Maps Collection Document

If `/api/maps/merged` is returning 404, the document doesn't exist in MongoDB.

### MongoDB Command:
```javascript
db.maps.insertOne({
  "name": "merged_map",
  "width": 100,
  "height": 100,
  "shelves": [
    {
      "x": 20,
      "y": 20,
      "shelf_id": "S1",
      "coords": [1, 1],
      "level": 1
    },
    {
      "x": 50,
      "y": 20,
      "shelf_id": "S2",
      "coords": [1, 2],
      "level": 1
    },
    {
      "x": 80,
      "y": 20,
      "shelf_id": "S3",
      "coords": [1, 3],
      "level": 1
    },
    {
      "x": 20,
      "y": 50,
      "shelf_id": "S4",
      "coords": [2, 1],
      "level": 2
    }
  ],
  "robots": [],
  "created_at": new Date(),
  "updated_at": new Date()
})
```

**How to run it:**
```bash
# In terminal, connect to MongoDB
mongo <your_database_name>

# Then paste the insertOne command above
```

---

## Verification Checklist

After making all changes:

- [ ] Fixed `dashboard_shelf_summary()` - uses `.get()` everywhere
- [ ] Fixed `dashboard_top_moving_products()` - uses `.get()` everywhere
- [ ] Fixed `dashboard_daily_movements()` - uses `.get()` everywhere
- [ ] Fixed robot update route - checks for None before access
- [ ] Created merged_map document in MongoDB
- [ ] Restarted Flask server
- [ ] Tested `/api/dashboard/shelves` - returns real data
- [ ] Tested `/api/maps/merged` - returns map data
- [ ] Frontend dashboard now shows real shelf data (not mock)

---

## Testing Commands

```bash
# Test dashboard shelves endpoint
curl http://localhost:5000/api/dashboard/shelves

# Expected response:
[
  {
    "shelf_id": "S1",
    "coords": [1, 1],
    "level": 1,
    "products": 5,
    "total_items": 25,
    "warehouse": "main",
    "status": "active"
  }
]

# Test maps endpoint
curl http://localhost:5000/api/maps/merged

# Expected response:
{
  "name": "merged_map",
  "width": 100,
  "height": 100,
  "shelves": [ ... ],
  "robots": [],
  "id": "507f1f77bcf86cd799439011"
}
```

---

## If You Still Get Errors

1. **Still getting KeyError: 'id'?**
   - Search for ALL occurrences of `['id']` in services.py
   - Replace EVERY one with `.get('correct_field_name')`

2. **Still getting 404 on maps?**
   - Verify the collection exists: `db.maps.find_one()`
   - Check the document name is exactly "merged_map"

3. **Frontend still showing fallback data?**
   - Clear browser cache (Ctrl+Shift+Delete)
   - Restart Flask server: `python app.py`
   - Check browser console for error messages

---

## Key Takeaway

**MongoDB Pattern for Safe Field Access:**
```python
# ❌ DANGEROUS - Crashes on missing field
value = doc['field_name']

# ✅ SAFE - Returns default if missing
value = doc.get('field_name', 'default_value')

# ✅ CORRECT - Converting MongoDB _id to string
id_string = str(doc['_id'])
```

Apply this pattern everywhere in your services.py file.
