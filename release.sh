#!/bin/bash
set -e

# Stalmer1 Release Script
# Usage: ./release.sh [version]

# Default to patch release if no version is specified
VERSION=${1:-patch}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Stalmer1 release process...${NC}"

# Ensure we're on the main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "${RED}Error: Not on main branch. Please checkout main branch before releasing.${NC}"
  exit 1
fi

# Ensure the working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}Error: Working directory not clean. Please commit or stash changes.${NC}"
  exit 1
fi

# Pull latest changes
echo -e "${GREEN}Pulling latest changes from main...${NC}"
git pull origin main

# Run tests to make sure everything passes
echo -e "${GREEN}Running tests...${NC}"
npm test

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Tests failed. Please fix failing tests before releasing.${NC}"
  exit 1
fi

# Build packages
echo -e "${GREEN}Building packages...${NC}"
npm run build

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Build failed. Please fix build errors before releasing.${NC}"
  exit 1
fi

# Update version in package.json files
echo -e "${GREEN}Updating version numbers...${NC}"
npm version $VERSION --workspaces --no-git-tag-version

# Get the new version number
NEW_VERSION=$(node -e "console.log(require('./package.json').version)")
echo -e "${GREEN}New version: ${NEW_VERSION}${NC}"

# Update CHANGELOG.md with new version and date
TODAY=$(date +%Y-%m-%d)
sed -i '' "s/## \[Unreleased\]/## [Unreleased]\n\n## [$NEW_VERSION] - $TODAY/" CHANGELOG.md || echo "No Unreleased section to update"

# Commit the version bump
echo -e "${GREEN}Committing version bump...${NC}"
git add .
git commit -m "chore: release v$NEW_VERSION"

# Create a git tag
echo -e "${GREEN}Creating git tag...${NC}"
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo -e "${YELLOW}Version v${NEW_VERSION} has been prepared for release.${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Review the changes: ${GREEN}git show${NC}"
echo -e "  2. Push the changes: ${GREEN}git push origin main --tags${NC}"
echo -e "  3. Publish to npm: ${GREEN}npm publish --workspaces${NC} (if applicable)"

exit 0
