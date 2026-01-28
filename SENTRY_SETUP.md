# How to Get VITE_SENTRY_DSN

## Step-by-Step Guide

### 1. Sign Up for Sentry (if you don't have an account)

1. Go to https://sentry.io/
2. Click "Sign Up" (or "Log In" if you have an account)
3. You can sign up with:
   - GitHub
   - Google
   - Email

### 2. Create a New Project

1. Once logged in, click **"Create Project"** or go to your dashboard
2. Select **"React"** as your platform (or "Browser JavaScript" if React isn't available)
3. Give your project a name (e.g., "eliza-dd-frontend")
4. Click **"Create Project"**

### 3. Get Your DSN

After creating the project, Sentry will show you a setup page with code snippets. Look for:

**The DSN (Data Source Name)** - It looks like:
```
https://abc123def456@o123456.ingest.sentry.io/1234567
```

Or in the Sentry dashboard:
1. Go to **Settings** → **Projects** → Select your project
2. Go to **Client Keys (DSN)**
3. Copy the **DSN** value

### 4. Add DSN to Your Environment

#### For Local Development:

Add to your `.env` file:
```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

#### For Production (Vercel):

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project: `eliza-dd-frontend`
3. Go to **Settings** → **Environment Variables**
4. Click **"Add New"**
5. Add:
   - **Key**: `VITE_SENTRY_DSN`
   - **Value**: `https://your-dsn@sentry.io/project-id`
   - **Environment**: Select "Production" (and optionally "Preview" and "Development")
6. Click **"Save"**
7. **Redeploy** your application for the changes to take effect

### 5. Install Sentry Package (Required)

The error tracking utility supports Sentry, but you need to install the package:

```bash
npm install @sentry/react
```

### 6. Verify It's Working

After deployment:
1. Trigger an error in your app (or wait for a real error)
2. Go to your Sentry dashboard
3. Check **Issues** - you should see errors appearing there

## Alternative: Use Without Sentry

If you don't want to set up Sentry right now, the error tracking will still work:

- Errors will be logged to the browser console
- The app will function normally
- You can add Sentry later without code changes

Just don't set `VITE_SENTRY_DSN` and the error tracking will use console fallback.

## DSN Format

A Sentry DSN typically looks like:
```
https://[public-key]@[organization].ingest.sentry.io/[project-id]
```

Example:
```
https://abc123def456789@o123456.ingest.sentry.io/1234567
```

## Security Note

- ✅ The DSN is **safe to expose** in client-side code (it's public by design)
- ✅ It only allows **sending** errors, not reading data
- ✅ You can regenerate it anytime from Sentry settings if needed

## Troubleshooting

**DSN not working?**
- Make sure you installed `@sentry/react`: `npm install @sentry/react`
- Check that the DSN is correctly formatted (starts with `https://`)
- Verify the environment variable is set in Vercel and you've redeployed
- Check browser console for Sentry initialization errors

**Want to test locally?**
- Add `VITE_SENTRY_DSN` to your `.env` file
- Run `npm run dev`
- Check browser console for "Sentry initialized" message
