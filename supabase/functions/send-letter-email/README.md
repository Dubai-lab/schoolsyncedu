# send-letter-email Edge Function

Sends transactional HTML emails via your configured SMTP server.

## Deploy

```bash
supabase functions deploy send-letter-email
```

## Required Secrets

Set these in **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

| Secret       | Example value               | Notes                                   |
|--------------|-----------------------------|-----------------------------------------|
| SMTP_HOST    | smtp.gmail.com              | Your SMTP server hostname               |
| SMTP_PORT    | 587                         | 587 for STARTTLS, 465 for SSL           |
| SMTP_USER    | yourname@gmail.com          | Email address used to authenticate      |
| SMTP_PASS    | your-app-password           | Password or Gmail App Password          |
| SMTP_FROM    | noreply@yourschool.edu.lr   | Optional — defaults to SMTP_USER        |
| SMTP_SECURE  | (leave blank for port 587)  | Set to `true` only for port 465 (SSL)   |

> **Gmail users:** Use an App Password (Google Account → Security → 2-Step Verification → App Passwords).
> Enable "Less secure app access" or use OAuth2 instead.

## What it does

1. Accepts `{ to, subject, html, fromName }` in the request body
2. Connects to your SMTP server using nodemailer
3. Sends the email and returns `{ success: true }` or `{ error: "..." }`

## Invoked by

`src/services/letterEmailService.ts` → called from `ApplicationDetail.tsx`
after the registrar clicks Accept or Reject on a student application.
