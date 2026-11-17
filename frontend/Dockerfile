FROM registry.docker.ir/library/node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com/
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build
FROM registry.docker.ir/library/nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
