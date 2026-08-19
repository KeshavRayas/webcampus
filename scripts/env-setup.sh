#!/bin/bash

set -e

if [ -f .env ]; then
  echo ".env already exists — skipping copy (single source of truth at repo root)."
  exit 0
fi

cp .env.example .env

echo ".env copied from .env.example!"