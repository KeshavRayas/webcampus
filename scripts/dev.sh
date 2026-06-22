#!/bin/bash
set -e

cleanup() {
  echo "Stopping dev processes..."
  taskkill //F //IM node.exe 2>/dev/null || true
  taskkill //F //IM bun.exe 2>/dev/null || true
}

trap cleanup INT TERM EXIT

# Print banner
bunx tsx scripts/banner.ts

# Start docker desktop
# docker desktop start

# Free up common development ports before starting the dev server
sh scripts/kill-ports.sh

# Starts db and other services required for bootstrap
bun dx

# Bootstrap the required resources
bun run bootstrap

# Seed the database
# bun turbo seed  


# Start the Turborepo development server using Bun
bunx turbo dev 
