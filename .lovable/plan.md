# Fix login "Invalid or missing x-shared-secret"

## Diagnosis

The app server (8080) and Nginx proxy (8081) are now healthy. The login failure is caused by the SAP middleware rejecting the shared-secret header the app sends.

The app reads the shared secret from `sap_global_secrets.proxy_secret` in the database and sends it as `x-shared-secret` to the middleware login endpoint.
The middleware compares it against the `MIDDLEWARE_SHARED_SECRET` value in its own `.env`.

The error message `Invalid or missing x-shared-secret` means these two values are not identical.

## Fix plan

1. Read the shared secret configured in the middleware.
   - On the quality server, open the middleware `.env` file (e.g. `/data/webapplication/resl_approval/Quality/backend/middleware/.env` or wherever the middleware compose is run).
   - Copy the exact value of `MIDDLEWARE_SHARED_SECRET`.

2. Update the app database so the app sends the same secret.
   - Use `psql` or any SQL client connected to the quality Supabase database.
   - Run:

     ```sql
     update public.sap_global_secrets
     set proxy_secret = '<exact secret from middleware .env>'
     where id = 'default';
     ```

   - Then verify:

     ```sql
     select proxy_secret from public.sap_global_secrets where id = 'default';
     ```

3. Verify the middleware URL is also stored in the app database.
   - The middleware is healthy on port 3002, so the app should point to it:

     ```sql
     select middleware_url from public.sap_global_settings where id = 'default';
     ```

   - It should return something like `http://127.0.0.1:3002` or `http://10.150.150.130:3002`. If it is NULL or points to a different host/port, update it:

     ```sql
     update public.sap_global_settings
     set middleware_url = 'http://127.0.0.1:3002'
     where id = 'default';
     ```

4. Restart the middleware and app server so they pick up the new values.
   - Restart the middleware container / process.
   - Re-run `bash deploy-frontend.sh` in the app `dist` folder to restart the app server.

5. Test login again at `http://10.150.150.130:8081/login`.

## Outcome

Login calls should reach the SAP middleware successfully instead of being rejected. Any further error will then be from the SAP Login_API itself, not from the shared-secret handshake.

## What to check first

If you cannot run SQL directly, first confirm which middleware `.env` is active and whether the value there was changed recently. The most common cause is the middleware `.env` containing a different secret than the one saved in the Lovable app / SAP API Settings → Middleware Configuration.
