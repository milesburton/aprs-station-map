FROM node:22-slim AS builder

WORKDIR /app

COPY package.json bun.lock* ./

# Convert bun.lock to package-lock.json if needed, then install
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create data directory with sample KML
RUN mkdir -p /usr/share/nginx/html/data
COPY data/stations.kml /usr/share/nginx/html/data/stations.kml

VOLUME /usr/share/nginx/html/data

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
