# Deploying Maitri 3.0 on AWS (single EC2 box)

This is a copy-paste runbook for a **first-time** AWS deploy. Everything runs in
Docker on one EC2 instance: the UI, both backends, Postgres, Redis, MinIO
(object storage) and a Caddy reverse proxy that gets you **real HTTPS with no
domain purchase** (via `sslip.io`).

```
                         ┌──────────── EC2 box ────────────┐
Internet ──443──▶ Caddy ─┤  web (Next.js)   api (Express)  │
                         │  worker  rules(FastAPI)         │
                         │  postgres  redis  minio         │
                         └─────────────────────────────────┘
```

Estimated time: **30–45 min**. Rough cost: a `t3.large` is ~US$0.08/hr — a few
dollars for a hackathon. **Stop the instance when you're done** (see the end).

---

## 0. What you need first

- An AWS account (root or an admin IAM user).
- An SSH key pair (create one in the EC2 console: **Key Pairs → Create**, download the `.pem`).
- The GitHub repo URL for this project.

---

## 1. Launch the EC2 instance

EC2 console → **Launch instance**:

| Setting | Value |
|---|---|
| Name | `maitri-prod` |
| AMI | **Ubuntu Server 24.04 LTS** |
| Instance type | **t3.large** (8 GB RAM — needed to build the Next.js image comfortably; `t3.medium` works with the swap step below) |
| Key pair | the one you created |
| Storage | **30 GB** gp3 |

**Network / security group** — create a new one with these inbound rules:

| Type | Port | Source |
|---|---|---|
| SSH | 22 | **My IP** |
| HTTP | 80 | Anywhere (0.0.0.0/0) |
| HTTPS | 443 | Anywhere (0.0.0.0/0) |

> Postgres, Redis and MinIO are **not** exposed — they're only reachable inside
> the Docker network. Never open 5432/6379/9000 to the internet.

### Give it a stable IP (important)

Your `SITE_HOST` is derived from the public IP, so it must not change on reboot.
EC2 console → **Elastic IPs → Allocate → Associate** it with the instance.

Note the Elastic IP, e.g. `13.201.45.6`.

---

## 2. Connect and install Docker

```bash
ssh -i /path/to/your-key.pem ubuntu@13.201.45.6

# Docker Engine + compose plugin (official convenience script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker            # apply the group without re-login

docker --version && docker compose version
```

**If you chose `t3.medium` (4 GB), add 2 GB swap** so the Next.js build doesn't
run out of memory:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Get the code and configure

```bash
git clone <YOUR_REPO_URL> maitri && cd maitri

cp .env.prod.example .env.prod
```

Now edit `.env.prod` (`nano .env.prod`). The two things you must get right:

**a) `SITE_HOST`** — turn your Elastic IP into an `sslip.io` host by replacing
dots with dashes:

```
Elastic IP 13.201.45.6  →  SITE_HOST=13-201-45-6.sslip.io
```

`sslip.io` resolves that name (and `s3.13-201-45-6.sslip.io`) straight to your
IP, so Caddy can issue Let's Encrypt certificates automatically.

**b) Every `CHANGE_ME`** — generate real secrets on the box:

```bash
openssl rand -hex 32     # run once per *_SECRET and INTERNAL_API_TOKEN
openssl rand -hex 16     # run for DB_PASSWORD, REDIS_PASSWORD, S3_ACCESS_KEY_ID
openssl rand -hex 24     # for S3_SECRET_ACCESS_KEY
```

Paste each output into the matching variable. Also set `ACME_EMAIL` to your email.

> **MinIO note:** `S3_SECRET_ACCESS_KEY` must be at least 8 characters and
> `S3_ACCESS_KEY_ID` at least 3, or MinIO won't start. The `openssl` hints above
> produce much longer values, so you're fine if you use them.

**OTP for applicants:** the stack defaults to `NODE_ENV=development` with a fixed
code **`123456`**, so applicants verify their phone with `123456` and you need no
SMS gateway. Inspectors don't use OTP at all (they log in with an access code).
Leave `OTP_PROVIDER=console`. To run a true production posture with real SMS
instead, follow the commented block in `.env.prod` (set `NODE_ENV=production`,
`OTP_PROVIDER=twilio`, and the `TWILIO_*` credentials).

---

## 4. Build and start everything

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

First run takes a few minutes (building three images + pulling Postgres/Redis/
MinIO/Caddy). The stack starts in order automatically: Postgres/Redis/MinIO
become healthy → **migrations run** (`migrate` service) → `api`, `worker`,
`web` and `caddy` come up.

Check status:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

`migrate` should show `Exited (0)` (it's a one-shot job); everything else
`running`/`healthy`.

---

## 5. Provision inspector logins

Inspectors don't self-register — you load their credentials. Create a JSON file
(see `node-backend/scripts/inspectors.example.json` for the shape):

```bash
cat > inspectors.json <<'JSON'
[
  { "name": "A. Sharma", "phoneNumber": "+919812345001", "departmentKey": "mpcb", "code": "MPCB-7788" }
]
JSON
```

Load it (runs in the migrate image, which has the seed tooling):

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml \
  run --rm -v "$PWD/inspectors.json:/app/inspectors.json" \
  migrate pnpm seed:inspectors /app/inspectors.json
```

Access codes are stored **hashed (Argon2id)** — never in plaintext. Delete
`inspectors.json` from the box afterwards.

---

## 6. Verify

Open **`https://<your SITE_HOST>`** in a browser (e.g.
`https://13-201-45-6.sslip.io`). You should get a valid padlock and the login
page.

- **Applicant:** register on the site (phone + password), then verify with the
  fixed code **`123456`**.
- **Inspector:** log in with the phone + access code you seeded in step 5.

Test a document upload and download — the presigned URL points at
`https://s3.<SITE_HOST>` and is served through Caddy from MinIO.

---

## 7. Day-to-day operations

```bash
# Compose is verbose — alias it for the session:
alias dc='docker compose --env-file .env.prod -f docker-compose.prod.yml'

dc ps                      # status
dc logs -f api             # tail a service (api|worker|web|rules|caddy)
dc restart api             # restart one service
dc down                    # stop everything (data volumes are kept)
dc up -d                   # start again
```

**Deploy an update** (after pushing new commits):

```bash
git pull
dc up -d --build           # rebuilds changed images; migrate re-runs migrations
```

**Back up the database** before risky changes:

```bash
dc exec postgres pg_dump -U maitri_3 maitri_3 > backup_$(date +%F).sql
```

Data lives in named Docker volumes (`maitri-prod-postgres-data`,
`-redis-data`, `-minio-data`), so `dc down` / reboots don't lose it. Only
`docker compose ... down -v` deletes data.

---

## 8. Stop paying when you're done

- **Pause (keep everything):** EC2 console → **Instance state → Stop**. You stop
  paying for compute; you keep paying a small amount for the EBS disk and the
  Elastic IP. Start it again anytime — the same IP/host still works.
- **Tear down fully:** **Terminate** the instance, then **release** the Elastic
  IP (unassociated Elastic IPs are billed).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser cert warning / "not secure" | DNS/cert needs a minute on first boot. Confirm `SITE_HOST` matches the Elastic IP with dashes, and ports 80+443 are open. Check `dc logs caddy`. |
| Applicant OTP won't verify | In the default demo mode the code is the fixed **`123456`**. If you switched to `NODE_ENV=production`, you must use Twilio (real SMS) instead. |
| Inspector login says invalid | Re-check the seeded phone (E.164) + access code; the code is case-sensitive and not trimmed, so avoid stray spaces. |
| `web` image build killed / OOM | You're on 4 GB without swap. Do the swap step in §2, then `dc up -d --build`. |
| Inspector can't log in | Re-check the seeded `phoneNumber` (E.164, e.g. `+9198...`) and that `departmentKey` exists. Re-run step 5. |
| Uploads/downloads fail | `dc logs api` for S3 errors; confirm `s3.<SITE_HOST>` opens in a browser and the `minio-setup` job created the bucket. |
| Everything 502 | An upstream isn't healthy yet: `dc ps`, then `dc logs <service>`. |

---

## Swapping MinIO for real AWS S3 (optional)

If you'd rather use a managed S3 bucket (browser downloads then hit AWS
directly), in `.env.prod`/compose set for the `api` and `worker` services:
blank `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE=false`, real `S3_REGION`, and the
bucket + IAM access keys. Remove the `minio`, `minio-setup` services and the
`s3.` block from the Caddyfile. Not needed for a hackathon demo.
