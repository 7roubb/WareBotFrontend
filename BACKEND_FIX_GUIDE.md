# Backend Fix Guide - KeyError 'id'

## Problem Summary

The backend is crashing with `KeyError: 'id'` when accessing `/api/dashboard/shelves`.

This means the `dashboard_shelf_summary()` function is trying to access an 'id' field that doesn't exist in the shelf documents.

## Root Cause Analysis

Looking at the error trace, the issue is in how the shelf data is structured:

**What the backend expects:**
```python
# Somewhere in dashboard_shelf_summary() function
shelves[i]['id']  # ← This field doesn't exist!
```

**What's actually in MongoDB:**
```json
{
  "_id": "507f1f77bcf86cd799439011",  // MongoDB uses _id, not id
  "shelf_id": "S1",
  "x_coord": 1,
  "y_coord": 2,
  // ... other fields
}
```

## Solution: Fix Backend Code

### Find the problematic code:

Search your `routes.py` or `services.py` for the `dashboard_shelf_summary()` function and look for:

```python
def dashboard_shelf_summary():
    db = get_db()
    shelves = list(db.shelves.find())
    
    # The bug is likely here ↓
    return [{
        "id": s['id'],  # ✗ This will crash - use s['_id'] or s['shelf_id'] instead
        "coords": [s['x_coord'], s['y_coord']],
        # ...
    } for s in shelves]
```

### Fixed version:

```python
def dashboard_shelf_summary():
    db = get_db()
    shelves = list(db.shelves.find())
    
    return [{
        "shelf_id": s.get('shelf_id', str(s['_id'])),  # ✓ Use shelf_id or convert _id to string
        "coords": [s.get('x_coord', 0), s.get('y_coord', 0)],
        "level": s.get('level', 1),
        "products": s.get('product_count', 0),
        "total_items": s.get('total_items', 0),
    } for s in shelves]
```

## Key Changes Needed:

1. **Replace `s['id']` with `s.get('shelf_id')` or `str(s['_id'])`**
   - MongoDB documents use `_id` as the primary key
   - Your shelves likely have a `shelf_id` field
   - Use `.get()` to safely access fields that might not exist

2. **Add `.get()` for all optional fields**
   - Prevents KeyError if a field is missing
   - Provides sensible defaults

3. **Ensure field names match your data structure**
   - Check what fields actually exist in your MongoDB shelf collection
   - Use `db.shelves.find_one()` in MongoDB to see the actual structure

## Testing the Fix:

1. **Check your shelf collection structure:**
```bash
# In MongoDB shell
db.shelves.findOne()
```

2. **Look for these fields:**
   - `_id` (always exists, MongoDB's default)
   - `shelf_id` (custom ID you probably created)
   - `x_coord`, `y_coord` (coordinates)
   - `level` (shelf level)

3. **After fixing, test with curl:**
```bash
curl http://localhost:5000/api/dashboard/shelves
```

Should return valid JSON like:
```json
[
  {
    "shelf_id": "S1",
    "coords": [1, 1],
    "level": 1,
    "products": 5,
    "total_items": 25
  }
]
```

## Same Issue May Exist In:

Check these functions too:
- `dashboard_top_moving_products()` - might have similar field access issues
- `dashboard_daily_movements()` - might have similar field access issues

Look for any line like `x['id']` and change to `x.get('_id')` or `x.get('proper_id_field')`

## Safe Coding Pattern for MongoDB:

Always use this pattern:
```python
def safe_function():
    db = get_db()
    docs = list(db.collection.find())
    
    return [{
        "field1": doc.get('field1', 'default_value'),
        "field2": doc.get('field2', 0),
        "id": str(doc['_id']),  # Always convert ObjectId to string
    } for doc in docs]
```

## Frontend Workaround (Already Applied)

The frontend now has fallback mock data, so the app will work while you fix the backend:
- Dashboard shows sample shelf data if backend fails
- Map shows default warehouse layout
- All endpoints gracefully handle errors

## Next Steps:

1. ✅ Identify the exact field names in your MongoDB shelves collection
2. ✅ Fix the `dashboard_shelf_summary()` function
3. ✅ Test with curl to verify it returns valid JSON
4. ✅ Restart Flask server
5. ✅ Refresh browser - dashboard should load real data now

---

**Need help?**
- Check Flask console for the exact error line number
- Use `db.shelves.findOne()` to see actual data structure
- Compare field names in database with what code is trying to access
