This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Newsletter Subscriber List

Newsletter registrations are stored as JSON Lines in `data/newsletter-subscribers.jsonl` by default. Set `NEWSLETTER_SUBSCRIBERS_FILE` to write the list somewhere else.

The default file storage requires a writable, persistent filesystem. For serverless deployments, use an external database or mailing-list provider instead of the default file path.

To export subscribers, set `NEWSLETTER_ADMIN_TOKEN` and call:

```bash
curl -H "Authorization: Bearer $NEWSLETTER_ADMIN_TOKEN" \
  "http://localhost:3000/api/newsletter/subscribers?format=csv"
```

Newsletter emails are sent from `DotCraft <dotcraft@cordmark.co.jp>`. In Resend, the sending domain must be verified and allowed to send from `dotcraft@cordmark.co.jp`.

To preview a delivery without sending:

```bash
curl -X POST "http://localhost:3000/api/newsletter/send" \
  -H "Authorization: Bearer $NEWSLETTER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "subject": "DotCraft Newsletter",
    "text": "本文をここに入力します。",
    "dryRun": true
  }'
```

To send it, use the same request with `"dryRun": false` or omit `dryRun`.

## Automated Video Newsletter

The daily cron job at `/api/cron/video-newsletter` checks YouTube once per day, extracts timestamps from the YouTube description, reads the YouTube caption transcript when available, falls back to OpenAI chunk transcription when captions are missing or empty, formats the transcript into readable Japanese paragraphs with DeepSeek, summarizes the episode with DeepSeek, sends the newsletter through Resend, and emails the delivery result to `dotcraft@cordmark.co.jp`.

Required environment variables:

```bash
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
SMTP_PASS=... # Resend API key; RESEND_API_KEY is also supported
YOUTUBE_API_KEY=...
YOUTUBE_CHANNEL_ID=...
CRON_SECRET=...
```

Optional environment variables:

```bash
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_MAX_TOKENS=12000
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe
OPENAI_TRANSCRIPTION_RESPONSE_FORMAT=json
OPENAI_TRANSCRIPTION_LANGUAGE=ja
OPENAI_TRANSCRIPTION_CHUNK_SECONDS=300
OPENAI_TRANSCRIPTION_CHUNK_BITRATE=64k
RESEND_API_KEY=...
FFMPEG_PATH=/usr/bin/ffmpeg
YOUTUBE_PLAYLIST_ID=...
YOUTUBE_AUDIO_MAX_BYTES=157286400
YTDLP_PATH=/usr/local/bin/yt-dlp
YTDLP_PYTHON=python3
YTDLP_JS_RUNTIME=node
YTDLP_REMOTE_COMPONENTS=ejs:github
VIDEO_NEWSLETTER_RUNS_FILE=data/video-newsletter-runs.jsonl
```

Manual dry-run:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/video-newsletter?dryRun=1"
```

OpenAI `gpt-4o-transcribe` is used for transcription when YouTube captions are unavailable or empty. Audio over the direct upload limit is converted into 5-minute mp3 chunks before transcription. YouTube audio is fetched from direct stream URLs first, then falls back to `yt-dlp` when `YTDLP_PATH` or Python `yt_dlp` is available. DeepSeek V4 Pro is used for transcript cleanup, paragraphing, the Japanese summary, and the newsletter draft. Transcript cleanup should preserve the original phrasing, tone, endings, and spoken texture; it should only improve punctuation, paragraphing, and obvious transcription errors.

Speaker diarization can still be enabled explicitly by setting `OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe-diarize`, `OPENAI_TRANSCRIPTION_RESPONSE_FORMAT=diarized_json`, and optionally `OPENAI_TRANSCRIPTION_MAX_CONCURRENCY=6`, but the default avoids speaker labels because chunked diarization can swap labels between chunks.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
