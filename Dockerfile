# ==========================================
# STAGE 1: Build & Compile TypeScript
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

# 1. Copy package configurations first to leverage build caching
COPY backend/package*.json ./backend/

# Install all dependencies (including devDependencies like TypeScript) inside the backend folder
RUN npm ci --prefix backend

# 2. Copy everything from the root at once
# Because of your .dockerignore, the "extension/" folder is completely skipped!
COPY . .

# Compile your TypeScript app using the "build": "tsc" script inside backend
RUN npm run build --prefix backend

# Remove devDependencies to keep the production image as light as possible
RUN npm prune --production --prefix backend


# ==========================================
# STAGE 2: Lightweight Production Runtime
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Set the production environment flag
ENV NODE_ENV=production

# Security: Create and switch to a secure, non-root user account
RUN addgroup -g 1001 -S nodeapp && adduser -S nodeapp -u 1001 -G nodeapp

# Copy the entire workspace from Stage 1 (already missing the extension folder)
COPY --from=builder --chown=nodeapp:nodeapp /app /app

# Inform Docker that the container listens on port 8000
EXPOSE 3000

# Change working location into the backend directory so the relative paths match your script
WORKDIR /app/backend

# Switch to the secure non-root user
USER nodeapp

# Start the server using your exact compiled .js path
CMD ["node", "dist/backend/src/server.js"]
