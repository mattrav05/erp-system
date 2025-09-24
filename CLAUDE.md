# Claude Code - Project Documentation

## Supabase CLI Authentication & Database Operations

### Updated Authentication Status (Sept 23, 2025)
**IMPORTANT**: Migrated from legacy JWT keys to new API key format

#### 1. New API Keys (Updated in .env.local)
- **Publishable Key**: `sb_publishable_iPBfZvunwyACs4d0lzr3JA_jzyAbdHJ`
- **Secret Key**: `sb_secret_WhuY5jf2DDI6pxm7UB98FQ_VRIyFfiy`

#### 2. CLI Authentication (for project operations)
```bash
export SUPABASE_ACCESS_TOKEN="sbp_636708b095bb2802fb1b0b67ff187031cfe1f5a7"
```

#### 3. Current Status
- ✅ Project linked: `tcwzhkeqwymqrljaadew`
- ✅ CLI authenticated
- ❌ Network connectivity issues (WSL2/IPv6)
- ⚠️ Shipping migration pending manual application

#### 3. Project Configuration
- **Project Reference**: `tcwzhkeqwymqrljaadew`
- **Project is linked**: Use `--linked` flag for database operations

### Correct Commands for Common Operations (Modern CLI)

#### Create Migration
```bash
supabase migration new <migration_name>
```

#### Apply Migrations (Dry Run)
```bash
supabase db push --dry-run
```

#### Apply Migrations (Live)
```bash
supabase db push
```

#### List Migrations
```bash
supabase migration list
```

#### Alternative with Environment Variables (if needed)
```bash
SUPABASE_ACCESS_TOKEN="sbp_636708b095bb2802fb1b0b67ff187031cfe1f5a7" supabase db push
```

### Common Issues & Solutions

#### ❌ SCRAM Authentication Errors
- **Error**: `failed SASL auth (invalid SCRAM server-final-message received from server)`
- **Cause**: Not using environment variables for authentication
- **Solution**: Always use both `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as environment variables

#### ❌ Interactive Password Prompts
- **Error**: CLI prompts for password interactively
- **Cause**: Missing `SUPABASE_DB_PASSWORD` environment variable
- **Solution**: Set `SUPABASE_DB_PASSWORD` in the command

#### ❌ Migration Conflicts
- **Error**: `ON CONFLICT` syntax errors or function dependency errors
- **Cause**: Using unsupported SQL syntax or missing functions
- **Solution**: Use `WHERE NOT EXISTS` instead of `ON CONFLICT` for conditional inserts

### Alternative: Direct SQL Execution
If CLI continues to fail, use the Supabase SQL Editor:
1. Go to: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new
2. Execute SQL directly in the browser interface

### Service Role Key (Read-Only Operations)
For diagnostics and verification, use the service role key with the JavaScript client:
```javascript
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
```

## Development Commands

### Start Development Server
```bash
npm run dev
```

### Build Project
```bash
npm run build
```

### Type Checking
```bash
npx next lint
```

## Project Structure Notes

### Estimates Module
- **Tables**: `sales_reps`, `estimate_templates`, `estimates`, `estimate_lines`
- **Location**: Sales reps management moved to Settings (first category)
- **Features**: Full CRUD, templates, bill-to/ship-to addresses, multi-user support

### Database Setup Status
- ✅ All estimates tables created and functional
- ✅ Default data seeded (3 templates + system admin)
- ✅ No console errors for database connections
- ⚠️ Sales Order migration pending - broken migration needs manual fix via Supabase Studio

### Sales Order System Implementation
**Status**: Code complete, database schema ready (pending migration fix)

**Components Created**:
- ✅ Sales Orders page (`src/app/sales-orders/page.tsx`)
- ✅ Sales Orders list component with search/filter
- ✅ Complete database schema with inventory reservation system

**Key Features**:
- Document linking system (estimate->SO->invoice->PO relationships)
- Inventory reservations (SO holds inventory, affects available quantity)
- Status workflow: PENDING → CONFIRMED (reserves) → SHIPPED → INVOICED (releases)
- Estimate reference stored in SO memo as requested

**To Complete**:
1. Fix migration via Supabase Studio SQL editor (apply `20250815160828_complete_sales_order_system.sql`)
2. Add Sales Orders to navigation
3. Create edit/create SO components (similar to estimates)

---
*Last Updated: 2025-08-15 - Sales Order system schema and UI foundation complete*