## Fix

The Price Approvals row shape uses the key `release_code1` (no underscore before `1`), while the current exclude list passes `release_code_1`. Since keys don't match, the column is still rendered.

### Change
- **`src/routes/_authenticated/sd.price.tsx`** (line 238): update exclude to `["release_code1", "release_code_1", "approval_status"]` so the Price screen hides `RELEASE CODE1` regardless of key spelling.

No other screens or server code change. Reports untouched.