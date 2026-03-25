# Stage 1: Build
FROM node:20-alpine AS build

ARG NPM_REGISTRY=""
ARG NPM_AUTH_TOKEN=""

WORKDIR /app

# Instalujemy pakiet CA – Alpine NIE ma go domyślnie
RUN apk add --no-cache ca-certificates

# Instalacja certyfikatu z sekretu
RUN --mount=type=secret,id=ca_cert,target=/run/secrets/ca.crt \
    mkdir -p /usr/local/share/ca-certificates && \
    cp /run/secrets/ca.crt /usr/local/share/ca-certificates/ca.crt && \
    update-ca-certificates

# NODE musi korzystać z certyfikatu systemowego
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Konfiguracja npm + token
RUN if [ -n "$NPM_REGISTRY" ]; then \
      echo "registry=${NPM_REGISTRY}" > .npmrc ; \
      echo "strict-ssl=true" >> .npmrc ; \
      if [ -n "$NPM_AUTH_TOKEN" ]; then \
        REGISTRY_HOST=$(echo "$NPM_REGISTRY" | sed 's|https\?://||'); \
        echo "//${REGISTRY_HOST}:_authToken=${NPM_AUTH_TOKEN}" >> .npmrc ; \
      fi ; \
    fi

COPY package.json package-lock.json ./

RUN npm ci --include=dev

COPY . .

ENV VITE_API_URL=""
RUN npm run build


# Stage 2 – Serve via nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
