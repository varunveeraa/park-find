# Deployment Guide for Park Find

## Quick Deployment to Netlify

Your Expo web app is ready for deployment! Here are three ways to deploy to Netlify:

### Method 1: Manual Deployment (Fastest)

1. **Build your app** (already done):
   ```bash
   npm run build:web
   ```

2. **Go to Netlify**:
   - Visit [https://app.netlify.com](https://app.netlify.com)
   - Sign up or log in

3. **Deploy manually**:
   - Click "Add new site" → "Deploy manually"
   - Drag and drop the entire `dist` folder onto the deployment area
   - Your site will be live in seconds!

### Method 2: Git-based Deployment (Recommended for Production)

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Connect to Netlify**:
   - Go to [https://app.netlify.com](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Choose your Git provider and select your repository

3. **Configure build settings**:
   - **Build command**: `npx expo export -p web`
   - **Publish directory**: `dist`
   - **Node version**: `22` (in Environment variables: `NODE_VERSION=22`)

4. **Deploy**: Click "Deploy site"

### Method 3: CLI Deployment (After Manual Setup)

Once you've created a site manually, you can use the CLI:

```bash
# Link your local project to the Netlify site
npx netlify link

# Deploy using the npm script
npm run deploy:netlify
```

## Your App Configuration

✅ **Static rendering enabled**: Your app uses `"output": "static"` which is perfect for Netlify
✅ **Build directory**: `dist` (automatically created)
✅ **Routes**: All routes are pre-rendered as separate HTML files
✅ **Assets**: All assets are properly bundled

## Environment Variables

If your app needs environment variables in production:

1. In Netlify dashboard → Site settings → Environment variables
2. Add any required variables (like API keys)
3. Redeploy your site

## Custom Domain (Optional)

After deployment, you can:
1. Go to Site settings → Domain management
2. Add your custom domain
3. Netlify will automatically handle SSL certificates

## Build Commands Reference

- `npm run build:web` - Build for web
- `npm run deploy:netlify` - Build and deploy to Netlify
- `npx expo serve` - Test the build locally

Your site will be available at a URL like: `https://amazing-app-name-123456.netlify.app`
