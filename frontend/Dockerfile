# Stage 1: Build
FROM node:20 AS build

ARG NPM_REGISTRY=""
ARG NPM_AUTH_TOKEN=""

WORKDIR /app

# Konfiguracja npm registry jeśli podano
RUN if [ -n "$NPM_REGISTRY" ]; then \
      echo "registry=${NPM_REGISTRY}" > .npmrc ; \
      if [ -n "$NPM_AUTH_TOKEN" ]; then \
        REGISTRY_HOST=$(echo "$NPM_REGISTRY" | sed 's|https\?://||'); \
        echo "//${REGISTRY_HOST}:_authToken=${NPM_AUTH_TOKEN}" >> .npmrc ; \
      fi ; \
    fi

COPY package.json package-lock.json ./

# Montujemy CA cert tak jak w backendzie
RUN --mount=type=secret,id=ca_cert,target=/etc/ssl/certs/ca.pem \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca.pem \
    npm ci --include=dev

COPY . .

ENV VITE_API_URL=""
RUN npx vite build

# Stage 2: Serve via nginx
FROM nginx:latest

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
