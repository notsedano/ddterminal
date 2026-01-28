# Rollback Procedure

## Vercel Deployment Rollback

### Automatic Rollback
Vercel automatically prevents deployment if the build fails. No manual intervention needed.

### Manual Rollback via Vercel Dashboard

1. **Navigate to Vercel Dashboard**
   - Go to: https://vercel.com/dashboard
   - Select your project: `eliza-dd-frontend`

2. **View Deployment History**
   - Click on "Deployments" tab
   - Find the previous working deployment

3. **Promote Previous Deployment**
   - Click the "..." menu on the previous deployment
   - Select "Promote to Production"
   - Confirm the rollback

### Manual Rollback via CLI

```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url>
```

### Emergency Rollback (Git-based)

If Vercel dashboard is unavailable:

1. **Revert to previous commit**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or checkout previous working commit**
   ```bash
   git checkout <previous-commit-hash>
   git push origin main --force
   ```

### Health Check

Before rollback, verify the issue:
- Check Vercel deployment logs
- Check browser console for errors
- Verify API endpoints are responding

### Post-Rollback Verification

1. Verify site loads correctly
2. Test critical user flows:
   - Chat functionality
   - Match panel loading
   - Authentication
3. Check error logs for new issues

### Rollback Triggers

Consider rolling back if:
- Build succeeds but site is broken
- Critical functionality fails
- Error rate spikes (>5% of requests)
- Performance degrades significantly

### Prevention

- Always test locally before pushing
- Use feature branches and PRs
- Enable Vercel preview deployments
- Monitor error rates after deployment
