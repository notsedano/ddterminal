# Troubleshooting Guide

## Tailwind CSS 4.x PostCSS Configuration Fix

### Issue
Error: `It looks like you're trying to use 'tailwindcss' directly as a PostCSS plugin. The PostCSS plugin has moved to a separate package, so to continue using Tailwind CSS with PostCSS you'll need to install @tailwindcss/postcss`

### Solution

The configuration files have been updated. You need to install the `@tailwindcss/postcss` package.

#### Option 1: Manual Installation (Recommended)

1. **Stop the dev server** (Ctrl+C in the terminal)

2. **Install the package:**
   ```bash
   npm install --save-dev @tailwindcss/postcss
   ```

3. **If that fails, try:**
   ```bash
   npm install --save-dev @tailwindcss/postcss --legacy-peer-deps --force
   ```

4. **Restart the dev server:**
   ```bash
   npm run dev
   ```

#### Option 2: Clean Install

If npm install continues to fail due to global node_modules issues:

1. **Close all terminals and VS Code**

2. **Delete node_modules and package-lock.json:**
   ```bash
   Remove-Item -Recurse -Force node_modules
   Remove-Item package-lock.json
   ```

3. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

4. **Reinstall all packages:**
   ```bash
   npm install
   ```

#### Option 3: Use Tailwind CSS 3.x (Stable)

If Tailwind 4.x continues to cause issues, downgrade to stable 3.x:

1. **Update package.json:**
   ```json
   "tailwindcss": "^3.4.0"
   ```
   (Remove `@tailwindcss/postcss` from devDependencies)

2. **Update postcss.config.js:**
   ```js
   export default {
     plugins: {
       tailwindcss: {},
       autoprefixer: {},
     },
   }
   ```

3. **Install:**
   ```bash
   npm install
   ```

### Current Configuration

✅ **postcss.config.js** - Updated to use `@tailwindcss/postcss`  
✅ **package.json** - Added `@tailwindcss/postcss` to devDependencies

### Verification

After installation, the dev server should start without the PostCSS error. The app should load at `http://localhost:5173`.
