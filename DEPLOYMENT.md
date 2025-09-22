# ERP System Deployment Guide

## Prerequisites

1. **Supabase Project**: Create a new project at [supabase.com](https://supabase.com)
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Git Repository**: Push this code to GitHub, GitLab, or Bitbucket

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### Required Environment Variables

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard > Settings > API |

## Database Setup

1. **Run the Schema**: Execute the SQL files in the `database/` folder in your Supabase SQL editor:
   ```sql
   -- Run these in order:
   database/schema.sql
   database/estimates-schema.sql
   database/multi-user-infrastructure.sql
   database/seed-data.sql
   ```

2. **Enable Row Level Security**: Make sure RLS is enabled on all tables

3. **Set up Auth Policies**: The schema includes the necessary auth policies

## Vercel Deployment

### Option 1: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Vercel will auto-detect Next.js settings
4. Add environment variables in the deployment settings
5. Deploy!

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Redeploy with environment variables
vercel --prod
```

## Post-Deployment

1. **Test Authentication**: Try logging in/out
2. **Verify Database Connections**: Check that data loads properly
3. **Test Core Features**:
   - Create an inventory item
   - Create a customer
   - Create an estimate
   - View reports

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify environment variables are set correctly
   - Check Supabase project is active
   - Ensure database schema is applied

2. **Authentication Issues**
   - Verify Supabase URL and keys
   - Check RLS policies are enabled
   - Ensure user profiles table exists

3. **Build Errors**
   - Run `npm run build` locally first
   - Check for TypeScript errors
   - Verify all dependencies are installed

### Support

- Check browser console for detailed error messages
- Review Vercel deployment logs
- Verify Supabase logs in the dashboard

## Features Included

- ✅ Complete inventory management
- ✅ Sales orders and estimates
- ✅ Purchase orders and receiving
- ✅ Invoice management
- ✅ Customer/vendor management
- ✅ Multi-user support
- ✅ Data import/export
- ✅ Comprehensive reporting
- ✅ Transaction history tracking
- ✅ Document flow tracking

## System Requirements

- Node.js 18+
- Modern browser (Chrome, Firefox, Safari, Edge)
- Supabase database
- Vercel hosting (or any Node.js host)