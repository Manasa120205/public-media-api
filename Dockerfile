FROM node:20-bullseye

# Install python3 and pip for yt-dlp extractor
RUN apt-get update && apt-get install -y python3 python3-pip ffmpeg && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip3 install --no-cache-dir yt-dlp

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
