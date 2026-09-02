#!/bin/bash
set -e

# turbo dev (persistent:true) handles SIGINT/SIGTERM; no manual pkill needed

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
