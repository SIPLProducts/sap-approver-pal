# How to mint Production ANON_KEY and SERVICE_ROLE_KEY

You already have `JWT_SECRET` set in `Production/backend/.env`. Use that same value to sign the two keys.

## 1. Get the value

Open `Production/backend/.env` and copy the `JWT_SECRET` value (do not copy any quotes or trailing spaces). In your screenshot:

```text
JWT_SECRET=52fc6cef97387945d4bc8a94ed4f826326e0cdab2020b67687abc93cf744e
```

Copy the part after `=` only.

## 2. Run the mint command on the server

SSH into the server and run:

```bash
JWT_SECRET='52fc6cef97387945d4bc8a94ed4f826326e0cdab2020b67687abc93cf744e'
IAT=$(date +%s)
EXP=$((IAT + 60*60*24*365*10))   # 10 years

mint() {
  header=$(printf '{"alg":"HS256","typ":"JWT"}' | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  payload=$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$1" "$IAT" "$EXP" \
    | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  sig=$(printf '%s.%s' "$header" "$payload" \
    | openssl dgst -binary -sha256 -hmac "$JWT_SECRET" \
    | openssl base64 -A | tr '+/' '-_' | tr -d '=')
  printf '%s.%s.%s\n' "$header" "$payload" "$sig"
}

echo "ANON_KEY=$(mint anon)"
echo "SERVICE_ROLE_KEY=$(mint service_role)"
```

## 3. Paste the output into the right places

- `Production/backend/.env`:
  ```text
  ANON_KEY=<output from ANON_KEY>
  SERVICE_ROLE_KEY=<output from SERVICE_ROLE_KEY>
  ```
- `Production/frontend/.env`:
  ```text
  VITE_SUPABASE_PUBLISHABLE_KEY=<output from ANON_KEY>
  SUPABASE_PUBLISHABLE_KEY=<output from ANON_KEY>
  SUPABASE_SERVICE_ROLE_KEY=<output from SERVICE_ROLE_KEY>
  ```

Both `.env` files must use the same anon key, and that key must be minted from the same `JWT_SECRET` that is in `Production/backend/.env`.

## 4. Restart / rebuild

After changing the backend `.env`, restart the Supabase stack:

```bash
cd /data/webapplication/resl_approval/Production/backend
docker compose -p resl_production down
docker compose -p resl_production up -d
```

After changing the frontend `.env`, rebuild and redeploy the app so the browser bundle picks up the new `VITE_SUPABASE_PUBLISHABLE_KEY`:

```bash
cd /data/webapplication/resl_approval/Production/frontend
rm -rf dist .output .wrangler
bash deploy-frontend.sh --port 8090 --nginx-port 9091
```

## Important

Do not use the Quality keys for Production unless the Quality `JWT_SECRET` is identical. The keys you pasted earlier were Quality's keys; if you keep them, you must also set Production's `JWT_SECRET` to the same Quality value. Otherwise, generate fresh Production keys as shown above.
