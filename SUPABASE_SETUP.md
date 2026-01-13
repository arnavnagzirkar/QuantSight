# Supabase Database Setup for QuantSight

Follow these steps to set up your Supabase database for authentication:

## 1. Create the Profiles Table

Run this SQL in your Supabase SQL Editor:

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

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_profile_updated
  before update on public.profiles
  for each row
  execute procedure public.handle_updated_at();

-- Create index on username for faster lookups
create index profiles_username_idx on public.profiles(username);
```

## 2. Enable Email Authentication

1. Go to **Authentication > Providers** in your Supabase dashboard
2. Enable **Email** provider
3. Configure email templates (optional but recommended):
   - **Confirm signup**: Customize the verification email
   - Set **Confirm your signup** template
   - Make sure the confirmation URL includes: `{{ .ConfirmationURL }}`

## 3. Configure OAuth Providers (Optional)

### Google OAuth:
1. Go to **Authentication > Providers**
2. Enable **Google**
3. Add your Google OAuth credentials:
   - Client ID
   - Client Secret
4. Add authorized redirect URL: `https://dwiigtlugzorgnyzfuqw.supabase.co/auth/v1/callback`

### GitHub OAuth:
1. Go to **Authentication > Providers**
2. Enable **GitHub**
3. Create a GitHub OAuth App:
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - New OAuth App
   - Authorization callback URL: `https://dwiigtlugzorgnyzfuqw.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret to Supabase

## 4. Configure Email Settings

1. Go to **Authentication > Email Templates**
2. Update **Site URL** to: `http://localhost:5173` (for development) or your production URL
3. Update **Redirect URLs** to include:
   - `http://localhost:5173/auth/callback`
   - Your production URL + `/auth/callback`

## 5. Email Verification Settings

1. Go to **Authentication > Settings**
2. Set **Confirm email** to `true` (required)
3. Set **Email confirmation** template
4. Optionally customize the email templates for better branding

## Testing the Setup

After running the SQL and configuring authentication:

1. Start your app: `npm run dev`
2. Go to `http://localhost:5173`
3. Click "Get Started" to register a new account
4. Check your email for the verification link
5. Click the link to verify your email
6. Sign in with your credentials

## Troubleshooting

### Issue: "Email not confirmed" error
- Check your email inbox (and spam folder)
- Resend the confirmation email from Supabase dashboard
- Verify that email templates are configured correctly

### Issue: OAuth not working
- Double-check OAuth provider credentials
- Verify redirect URLs match exactly
- Check browser console for errors

### Issue: Profile not created
- Check Supabase logs in the dashboard
- Verify the profiles table was created correctly
- Check RLS policies are set up

## Production Deployment

When deploying to production:

1. Update **Site URL** in Supabase settings to your production domain
2. Add production callback URLs to **Redirect URLs**
3. Update `.env` file with production URLs (or use environment variables)
4. Enable **Email rate limiting** to prevent abuse
5. Configure **Custom SMTP** for branded emails (optional)

## Security Recommendations

1. ✅ Row Level Security (RLS) is enabled
2. ✅ Email verification required
3. Consider enabling **2FA** for sensitive accounts
4. Review and update **Password requirements** in Authentication settings
5. Set up **Captcha** to prevent bot registrations
6. Monitor **Authentication logs** regularly
