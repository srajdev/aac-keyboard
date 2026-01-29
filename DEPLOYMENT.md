# Viraj Keyboard - Deployment Guide

## Live URL
https://vdk.srajdev.com

---

## Quick Reference

### Check Status
```bash
# App status
sudo systemctl status viraj-keyboard

# Caddy status
sudo systemctl status caddy
```

### View Logs
```bash
# App logs (live)
sudo journalctl -u viraj-keyboard -f

# App logs (last 50 lines)
sudo journalctl -u viraj-keyboard -n 50

# Caddy logs
sudo journalctl -u caddy -f
```

### Restart Services
```bash
# Restart app (after code changes)
sudo systemctl restart viraj-keyboard

# Restart Caddy (after config changes)
sudo systemctl restart caddy
```

---

## After Making Code Changes

1. Make your changes to the code
2. Restart the app:
   ```bash
   sudo systemctl restart viraj-keyboard
   ```
3. Check it's running:
   ```bash
   sudo systemctl status viraj-keyboard
   ```
4. Check logs for errors:
   ```bash
   sudo journalctl -u viraj-keyboard -n 20
   ```

---

## Local Development

Run the app locally (not as a service):

```bash
# Stop the service first
sudo systemctl stop viraj-keyboard

# Run manually with auto-reload
cd /home/ubuntu/viraj-keyboard
source venv/bin/activate
uvicorn server.main:app --host 0.0.0.0 --port 3000 --reload

# When done, restart the service
sudo systemctl start viraj-keyboard
```

---

## Service Locations

| What | Location |
|------|----------|
| App service file | `/etc/systemd/system/viraj-keyboard.service` |
| Caddy config | `/etc/caddy/Caddyfile` |
| App code | `/home/ubuntu/viraj-keyboard` |
| SSL certificates | `/var/lib/caddy/.local/share/caddy/` (auto-managed) |

---

## Troubleshooting

### App won't start
```bash
# Check what's using port 3000
sudo lsof -i:3000

# Kill it and restart
sudo lsof -ti:3000 | xargs -r sudo kill -9
sudo systemctl restart viraj-keyboard
```

### Check if site is reachable
```bash
curl -I https://vdk.srajdev.com
```

### Reload systemd after editing service file
```bash
sudo systemctl daemon-reload
sudo systemctl restart viraj-keyboard
```
