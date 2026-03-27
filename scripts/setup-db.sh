#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Setting up LiveViewRedroid database..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
  echo -e "${RED}✗ PostgreSQL client not found${NC}"
  echo "Install it with:"
  echo "  Ubuntu/Debian: sudo apt install -y postgresql-client"
  echo "  macOS: brew install postgresql"
  echo "  Arch: sudo pacman -S postgresql"
  exit 1
fi

# PostgreSQL connection details (default)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="liveviewbot"
DB_NEW_USER="palvia"
DB_NEW_PASSWORD="soleplayer"

echo -e "${BLUE}PostgreSQL Details:${NC}"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Admin User: $DB_USER"
echo ""

# Create database and user
echo -e "${BLUE}Creating database and user...${NC}"

PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER"

# Create user
$PSQL_CMD -tc "SELECT 1 FROM pg_user WHERE usename = '$DB_NEW_USER'" | grep -q 1 || \
  $PSQL_CMD -c "CREATE USER $DB_NEW_USER WITH PASSWORD '$DB_NEW_PASSWORD';"

echo -e "${GREEN}✓ User $DB_NEW_USER created${NC}"

# Create database
$PSQL_CMD -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
  $PSQL_CMD -c "CREATE DATABASE $DB_NAME OWNER $DB_NEW_USER;"

echo -e "${GREEN}✓ Database $DB_NAME created${NC}"

# Grant privileges
$PSQL_CMD -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_NEW_USER;"

echo -e "${GREEN}✓ Privileges granted${NC}"

# Run migrations
echo ""
echo -e "${BLUE}Running migrations...${NC}"
npm run db:generate
npm run db:migrate

echo ""
echo -e "${GREEN}✓ Database setup complete!${NC}"
echo ""
echo "Connection string:"
echo "  postgresql://$DB_NEW_USER:$DB_NEW_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "Start the server:"
echo "  npm run dev"
