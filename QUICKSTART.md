# 🚀 Quick Start Guide - QuantSight

Welcome to QuantSight! This guide will get you up and running in minutes.

## What You Just Set Up

✅ **Supabase Integration** - Backend authentication service  
✅ **Landing Page** - Beautiful introduction to your platform  
✅ **User Registration** - Email + password with social OAuth  
✅ **Email Verification** - Security requirement before access  
✅ **Protected Routes** - Secure access to all features  
✅ **User Profiles** - Store user data and preferences  
✅ **Logout Functionality** - Sign out from Settings page

## 🎯 Next Steps

### 1. Set Up Supabase Database (REQUIRED)

Open your Supabase dashboard and run this SQL:

```sql
-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  username text unique not null,
  use_case text not null check (use_case in ('personal', 'company', 'student')),
  company_name text,
  role text,
  email_verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = id );
```

📝 **Full setup instructions:** See [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

### 2. Configure Email Settings in Supabase

1. Go to **Authentication > Settings** in Supabase
2. Set **Site URL** to: `http://localhost:5173`
3. Add to **Redirect URLs**: `http://localhost:5173/auth/callback`
4. Enable **Confirm email** option

### 3. (Optional) Enable OAuth Providers

#### Google:
- Get credentials from Google Cloud Console
- Add to Supabase: **Authentication > Providers > Google**

#### GitHub:
- Create OAuth App at GitHub Settings
- Add to Supabase: **Authentication > Providers > GitHub**

### 4. Test Your Setup

```powershell
# Start the app
npm run dev
```

Then:
1. Visit `http://localhost:5173`
2. Click "Get Started"
3. Fill in registration form
4. Check email for verification link
5. Click link and sign in
6. Access the platform! 🎉

## 📱 App Flow

```
Landing Page (/) 
    ↓
Sign Up (/register) → Email Verification → Sign In (/login)
    ↓
Dashboard (/dashboard) → All Features Protected
    ↓
Settings (/settings) → Sign Out
```

## 🎨 What Users See

### Before Authentication:
- **Landing Page**: Feature showcase, pricing, call-to-action
- **Login Page**: Email/password + Google/GitHub
- **Register Page**: Collects user info + use case

### After Authentication:
- **Dashboard**: Full platform access
- **All Pages**: Factor Explorer, Model Lab, etc.
- **Settings**: Account info + logout button

## 🔐 Security Features

✅ **Email Verification Required** - Users must verify email before access  
✅ **Row Level Security** - Database policies protect user data  
✅ **Protected Routes** - Automatic redirect to login  
✅ **Secure Tokens** - JWT-based authentication  
✅ **OAuth Support** - Industry-standard social login

## 🐛 Troubleshooting

### "Email not confirmed" error
- Check your email (including spam folder)
- Resend from Supabase dashboard: **Authentication > Users**

### OAuth not working
- Verify redirect URLs match exactly
- Check OAuth credentials in Supabase

### Profile not created
- Ensure SQL script ran successfully
- Check Supabase logs for errors

### Can't access app features
- Make sure you verified your email
- Try signing out and back in

## 📚 Key Files

- **`contexts/AuthContext.tsx`** - Authentication logic
- **`components/pages/LandingPage.tsx`** - Home page
- **`components/pages/LoginPage.tsx`** - Sign in
- **`components/pages/RegisterPage.tsx`** - Sign up
- **`components/pages/Settings.tsx`** - Account + logout
- **`components/ProtectedRoute.tsx`** - Route protection
- **`App.tsx`** - Routing configuration
- **`services/supabase.ts`** - Supabase client

## 🎓 Learn More

- [Supabase Docs](https://supabase.com/docs)
- [React Router](https://reactrouter.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 🎉 You're All Set!

Your app now has:
- Professional landing page
- Secure authentication
- User registration with custom fields
- Email verification
- Social login (Google, GitHub)
- Protected application routes
- Logout functionality

**Ready to build something amazing! 🚀**
