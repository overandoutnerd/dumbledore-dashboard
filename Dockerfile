FROM node:22-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

ENV NODE_ENV=production

# Your Express server (change if your app uses a different port)
EXPOSE 3000

CMD ["npm", "start"]
