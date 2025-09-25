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
**CONFIRMED WORKING METHOD**: CLI has persistent IPv6 connectivity issues in WSL2, use Supabase SQL Editor:
1. Go to: https://supabase.com/dashboard/project/tcwzhkeqwymqrljaadew/sql/new
2. Copy SQL from migration files in `supabase/migrations/` directory
3. Execute SQL directly in the browser interface
4. **VERIFIED**: This method has been used successfully for ALL previous migrations including estimates, sales orders, etc.

**CLI Success After Update**:
- **Updated CLI to v2.45.5 (Sept 24, 2025)**: IPv6 connectivity issue RESOLVED! 🎉
- `supabase link --project-ref tcwzhkeqwymqrljaadew` - SUCCESS
- `supabase migration repair` - SUCCESS
- `supabase db push --linked` - SUCCESS ("Remote database is up to date")

**Previous Failed Attempts**:
- Old CLI v2.40.7: IPv6 network unreachable
- Windows CMD and PowerShell approaches (supabase command not found)
- PowerShell + npx approach: DNS resolution issues

**ROOT CAUSE IDENTIFIED & RESEARCHED (Sept 24, 2025)**:
- **Supabase transitioned to IPv6-only direct connections** in early 2024
- **WSL2 has no IPv6 connectivity** (confirmed: `curl -6` fails with "Couldn't connect to server")
- Database host `db.tcwzhkeqwymqrljaadew.supabase.co` resolves to IPv6-only: `2600:1f16:1cd0:331c:4d06:2998:8c9c:3b38`
- **This is a known WSL2/Supabase compatibility issue** affecting many developers in 2025

**OFFICIAL SOLUTIONS FROM SUPABASE**:
1. **For CLI migrations**: Use Supabase SQL Editor (web interface) - bypasses WSL2 entirely ✅
2. **For applications**: Use Supavisor Connection Pooler (IPv4-compatible session mode)
3. **Enterprise option**: IPv4 Add-On ($4/month) for Pro+ organizations

**WSL2 IPv6 Status**: Architectural limitation, not fixable through network configuration

**Current Pending Migration**: `20250924173240_enhanced_company_profile.sql`
- Location: `supabase/migrations/20250924173240_enhanced_company_profile.sql`
- Creates enhanced_company_settings table with 60+ comprehensive business fields
- Includes data migration function to preserve existing company_settings data

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

### Local TypeScript Validation (Before Push)
**IMPORTANT**: When development server is running, always check TypeScript errors locally before pushing to save time:
```bash
npx tsc --noEmit
```
- This catches build failures before Vercel deployment
- Faster feedback loop than waiting for remote build errors
- Essential for syntax errors, JSX issues, and type mismatches

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

### Enhanced Company Profile System Implementation
**Status**: Code complete, UI ready, migration pending database application

**Components Created**:
- ✅ Enhanced company profile schema with 60+ comprehensive business fields
- ✅ Enhanced company settings UI with 6 organized tabs (Basic, Addresses, Contact, Financial, Branding, Advanced)
- ✅ Enhanced useCompanySettings hook with backward compatibility
- ✅ Settings page integration complete

**Key Features**:
- Complete business information management (legal names, tax IDs, multiple addresses, branding, etc.)
- Smart fallback to legacy company_settings table for compatibility
- Professional tabbed interface with form validation
- Additional helper methods for address formatting and contact info

**To Complete**:
1. Apply migration via Supabase Studio SQL editor (`supabase/migrations/20250924173240_enhanced_company_profile.sql`)
2. Test enhanced company profile functionality
3. All existing modules will automatically benefit from richer company data

---
*Last Updated: 2025-09-24 - Enhanced Company Profile system complete, pending database migration*