# Re-apply / Verify Validation Limits for Large User Creation

## What is needed

You want the fix that lets Create User pass with 426 plants and 3,500+ role rows back in your build and redeployed.

## Current state

I verified `src/lib/admin/user-mgmt.functions.ts` and the limits are already raised:

- `createUser`: plants `.max(5000)`, roles `.max(5000)` (lines 66-67).
- `createUserViaSap`: plants `.max(5000)`, roles `.max(50000)` (lines 230-234).
- `listRolesForPlants`: plants `.max(5000)` (line 308).
- `inviteUser`: plants `.max(5000)` (line 155).

So the code change is already present in the workspace. No re-coding is required.

## What the plan does

1. Run a build/typecheck to confirm the code compiles cleanly.
2. Publish the project so the Lovable live preview and custom domain serve the current build.
3. Give you the exact Quality-server redeploy commands to pull the published build into your self-hosted environment.

## Note about Git

Git is managed internally by the Lovable platform. You do not need to `git push` from the terminal. Each chat message/Restore point is already a tracked version. To move forward, you publish the current workspace and then redeploy on your server.

## Quality redeploy steps

After publishing, on your Quality server:

```bash
cd /data/webapplication/resl_approval/Quality/frontend
bash deploy-frontend.sh
```

The script will build `dist/`, verify the server starts, and leave it running on port 8080. Then Nginx on port 8081 proxies to it.
