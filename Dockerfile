FROM node:20-alpine

# Install Python3, pip, ffmpeg, and ca-certificates
RUN apk add --no-cache python3 py3-pip ffmpeg ca-certificates curl && \
    ln -sf python3 /usr/bin/python

# Install yt-dlp python package for the live extractor
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV PORT=10000
ENV NODE_ENV=production
ENV MEDIA_PROVIDER=live
ENV MONTHLY_QUOTA_ENABLED=true
ENV MONTHLY_DOWNLOAD_LIMIT=5000
ENV CORS_ORIGIN=*

EXPOSE 10000

CMD ["npm", "start"]
