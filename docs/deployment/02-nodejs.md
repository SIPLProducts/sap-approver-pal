# 02 — Node.js Installation

Two runtimes are needed:

| Runtime | Used for |
|---|---|
| **Node.js 22 LTS** | running the SAP middleware and PM2 |
| **Bun** | installing/building the frontend (the repo ships `bun.lock`) |

---

## 1. Install Node.js 22 LTS from NodeSource

Ubuntu's own `nodejs` package lags behind. Use the NodeSource repository.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
```

What those commands do:

- the `setup_22.x` script adds NodeSource's signing key and apt repository
- `apt install nodejs` installs Node **and** the matching `npm`

## 2. Verify

```bash
node -v      # v22.x.x
npm -v       # 10.x
which node   # /usr/bin/node
```

Record the exact versions in your change ticket — PM2 keeps a reference to the
interpreter path.

## 3. npm hygiene

Global installs should not require `sudo` for the `deploy` user's own tools,
but PM2 is intentionally installed globally as root so the boot service can
find it (guide 03).

```bash
npm config set fund false
npm config set audit false      # CI noise; run `npm audit` deliberately instead
npm config get prefix           # /usr
```

## 4. Install Bun (frontend build)

```bash
curl -fsSL https://bun.sh/install | bash
# The installer writes to ~/.bun and appends to ~/.bashrc
source ~/.bashrc
bun --version                   # 1.x
```

Make Bun available to non-login shells used by scripts:

```bash
sudo ln -sfn "$HOME/.bun/bin/bun" /usr/local/bin/bun
bun --version
```

> Run the Bun installer as the **`deploy`** user, because `deploy` performs the
> builds. If you install it as another user, the symlink above still exposes it
> system-wide but the cache lives in that user's home.

## 5. Optional — nvm for multiple Node versions

Only needed if you must pin a different Node version per environment later.

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install --lts
nvm alias default lts/*
node -v
```

Caveats when using nvm with PM2:

- PM2 must be installed **inside** the nvm-managed Node version
- `pm2 startup` generates a unit that references that version's absolute path
- after `nvm install` of a new version you must re-run `pm2 unstartup` /
  `pm2 startup` and `pm2 save`

For a single-purpose server, the NodeSource install above is simpler and is
what the rest of this handbook assumes.

## 6. Verification checklist

```bash
node -v && npm -v && bun --version
node -e "console.log('node ok', process.version)"
```

Next: [03 — PM2 Installation](./03-pm2.md)
