# Stage 1: Build
FROM node:20-alpine AS build

ARG NPM_REGISTRY=""
ARG NPM_AUTH_TOKEN=""

WORKDIR /app

# Configure JFrog/custom npm registry if provided
RUN if [ -n "$NPM_REGISTRY" ]; then \
    echo "registry=${NPM_REGISTRY}" > .npmrc && \
    if [ -n "$NPM_AUTH_TOKEN" ]; then \
      REGISTRY_HOST=$(echo "$NPM_REGISTRY" | sed 's|https\?://||') && \
      echo "//${REGISTRY_HOST}:_authToken=${NPM_AUTH_TOKEN}" >> .npmrc; \
    fi; \
    fi

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# API calls will be relative — nginx proxies /api to backend
ENV VITE_API_URL=""
RUN npx vite build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
