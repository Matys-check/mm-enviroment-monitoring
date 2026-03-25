# Centralny Nginx - konfiguracja dla Monitor Dashboard

Dodaj poniższy blok do konfiguracji centralnego nginx:

```nginx
location /dashboard/ {
    proxy_pass http://127.0.0.1:3100/dashboard/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Po dodaniu przeładuj nginx:
```bash
sudo nginx -t && sudo nginx -s reload
```

Lub jeśli nginx jest w Dockerze:
```bash
docker exec centralny-nginx nginx -t && docker exec centralny-nginx nginx -s reload
```
