# 🚀 Deployment Guide - QuantSight

This guide will walk you through deploying your QuantSight platform to **Vercel** (frontend) and **Render** (backend).

---

## 📋 Prerequisites

- GitHub account
- Vercel account (sign up at [vercel.com](https://vercel.com))
- Render account (sign up at [render.com](https://render.com))
- Your code pushed to GitHub

---

## Part 1: Deploy Backend to Render

### Step 1: Push to GitHub

Ensure your latest code is on GitHub:
```powershell
git add .
git commit -m "Reorganized for deployment"
git push origin main
```

### Step 2: Create New Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your repository

### Step 3: Configure Service

**Basic Settings:**
- **Name:** `quantsight-backend` (or your preferred name)
- **Region:** Choose closest to your users
- **Branch:** `main`
- **Root Directory:** `backend`
- **Runtime:** `Python 3`

**Build Settings:**
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `python main.py`

**Instance Type:**
- Select **"Free"** (750 hours/month)
- Or **"Starter"** ($7/month - no cold starts)

### Step 4: Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these:
```
NEWS_API_KEY=14db3569c50541b19fb70ca54ed62923
PORT=5000
PYTHON_VERSION=3.11
```

### Step 5: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete (5-10 minutes first time)
3. Once deployed, copy your backend URL: `https://quantsight-backend.onrender.com`

### Step 6: Test Backend

Visit: `https://your-app-name.onrender.com/api/dashboard/overview`

You should see JSON data or a response!

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Update Frontend Environment Variables

Edit `frontend/.env.production`:
```env
VITE_SUPABASE_URL=https://dwiigtlugzorgnyzfuqw.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_-j486g6_O4HF0S9wnbFuRg_Zp3NJM7t
VITE_API_BASE_URL=https://quantsight-backend.onrender.com
```

Replace `quantsight-backend` with your actual Render service name.

Commit and push:
```powershell
git add .
git commit -m "Updated production API URL"
git push origin main
```

### Step 2: Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Click **"Import"**

### Step 3: Configure Project

**Framework Preset:**
- Select **"Vite"**

**Root Directory:**
- Click **"Edit"**
- Select **`frontend`**

**Build Settings:**
- Build Command: `npm run build` (auto-detected)
- Output Directory: `dist` (auto-detected)
- Install Command: `npm install` (auto-detected)

### Step 4: Add Environment Variables

Click **"Environment Variables"** and add:

```
VITE_SUPABASE_URL=https://dwiigtlugzorgnyzfuqw.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_-j486g6_O4HF0S9wnbFuRg_Zp3NJM7t
VITE_API_BASE_URL=https://quantsight-backend.onrender.com
```

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for build (2-3 minutes)
3. Your site is live at: `https://your-project.vercel.app`

### Step 6: Update Backend CORS

Go back to your `backend/main.py` and update the CORS origins:

```python
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5173",
            "https://*.vercel.app",
            "https://your-project.vercel.app"  # Add your actual Vercel URL
        ],
        ...
    }
})
```

Commit and push - Render will auto-deploy.

---

## Part 3: Update Supabase Settings

### Configure Redirect URLs

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Add to **Redirect URLs:**
   ```
   https://your-project.vercel.app/auth/callback
   ```
5. Update **Site URL** to: `https://your-project.vercel.app`

---

## 🎉 You're Live!

Your app is now deployed:
- **Frontend:** `https://your-project.vercel.app`
- **Backend:** `https://quantsight-backend.onrender.com`

---

## 🔧 Local Development Setup

After reorganization, here's how to run locally:

### Terminal 1: Backend
```powershell
cd backend
pip install -r requirements.txt
python main.py
```
Backend runs at `http://localhost:5000`

### Terminal 2: Frontend
```powershell
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`

---

## 📝 Troubleshooting

### Frontend can't connect to backend
- Check `VITE_API_BASE_URL` in Vercel environment variables
- Verify backend is running on Render
- Check CORS settings in `backend/main.py`

### Backend shows errors
- Check Render logs: Dashboard → Your Service → "Logs"
- Verify all environment variables are set
- Check `requirements.txt` has all dependencies

### Supabase auth not working
- Verify redirect URLs in Supabase dashboard
- Check environment variables in Vercel
- Ensure `.env.production` has correct values

### Render cold starts (Free tier)
- First request after inactivity takes 30-60 seconds
- Upgrade to Starter ($7/month) for instant responses
- Or use a ping service to keep it warm (not recommended)

---

## 💰 Cost Breakdown

**Free Tier:**
- Vercel: FREE (100GB bandwidth, unlimited projects)
- Render: FREE (750 hours/month, one service 24/7)
- Supabase: FREE (500MB database, 50k MAU)
- **Total: $0/month**

**Recommended Paid:**
- Vercel: FREE
- Render Starter: $7/month (no cold starts)
- Supabase Free tier
- **Total: $7/month**

---

## 🔄 Automatic Deployments

Both platforms auto-deploy when you push to GitHub:

```powershell
git add .
git commit -m "Your changes"
git push origin main
```

- **Vercel:** Deploys in ~2 minutes
- **Render:** Deploys in ~5 minutes

---

## 🎯 Next Steps

1. ✅ Set up custom domain on Vercel
2. ✅ Monitor Render backend logs
3. ✅ Set up Supabase database backups
4. ✅ Configure analytics (Vercel Analytics)
5. ✅ Set up error monitoring (Sentry)

---

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Supabase Documentation](https://supabase.com/docs)

**Need help?** Check the logs on each platform or open an issue!
