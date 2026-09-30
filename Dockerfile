FROM node:24-alpine AS web
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY web ./web
RUN npm run build:web

FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev
COPY src ./src
COPY --from=web /app/public ./public
ENV NODE_ENV=production
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "src/server.js"]
