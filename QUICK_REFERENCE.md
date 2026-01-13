# ⚡ QuantSight - Quick Reference

## 📂 Project Organization

```
frontend/  → Deploy to Vercel (React app)
backend/   → Deploy to Render (Flask API)
```

## 🚀 Local Development Commands

### Start Backend
```powershell
cd backend
pip install -r requirements.txt
python main.py
```
→ Runs at `http://localhost:5000`

### Start Frontend
```powershell
cd frontend
npm install
npm run dev
```
→ Runs at `http://localhost:5173`

## 🌐 Deployment Checklist

### ✅ Backend (Render)
1. Push code to GitHub
2. Create Web Service on Render
3. Root directory: `backend`
4. Build: `pip install -r requirements.txt`
5. Start: `python main.py`
6. Add env vars: `NEWS_API_KEY`, `PORT=5000`
7. Copy backend URL: `https://your-app.onrender.com`

### ✅ Frontend (Vercel)
1. Import project from GitHub
2. Framework: Vite
3. Root directory: `frontend`
4. Add env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_BASE_URL` (use Render URL)
5. Deploy!

### ✅ Supabase
1. Run SQL from `SUPABASE_SETUP.md`
2. Set Site URL to Vercel URL
3. Add redirect URL: `https://your-app.vercel.app/auth/callback`
4. Enable Email + OAuth providers

## 🔑 Environment Variables

### Frontend (`frontend/.env`)
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
VITE_API_BASE_URL=http://localhost:5000  # Local
# VITE_API_BASE_URL=https://your-app.onrender.com  # Production
```

### Backend (`backend/.env`)
```env
NEWS_API_KEY=your_key_here
PORT=5000
```

## 📝 Key Files Modified

- `backend/main.py` - Added CORS support
- `backend/requirements.txt` - Added flask-cors
- `frontend/.env` - Environment variables
- `frontend/vercel.json` - Vercel config

## 🆘 Quick Troubleshooting

**Frontend can't connect to backend:**
- Check `VITE_API_BASE_URL` is correct
- Verify backend is running
- Check browser console for CORS errors

**Backend CORS errors:**
- Update allowed origins in `backend/main.py`
- Add your Vercel URL to CORS origins

**Supabase auth not working:**
- Check redirect URLs match
- Verify environment variables
- Check browser console

## 💰 Cost Summary

**Free Tier (Both Platforms):**
- Vercel: FREE forever
- Render: FREE (750 hrs/month)
- Supabase: FREE (500MB DB)
- **Total: $0/month**

**Recommended Paid:**
- Render Starter: $7/month (no cold starts)
- **Total: $7/month**

## 📚 Full Documentation

- [README.md](README.md) - Main documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Database setup
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - File organization

## 🎯 Next Steps

1. ✅ Test locally (both backend + frontend)
2. ✅ Commit and push to GitHub
3. ✅ Deploy backend to Render
4. ✅ Deploy frontend to Vercel
5. ✅ Update CORS and env variables
6. ✅ Test production deployment
7. ✅ Set up custom domain (optional)

**Ready to deploy? See [DEPLOYMENT.md](DEPLOYMENT.md)!**
