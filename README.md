This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Calendar events are loaded from `app/data/events.csv`. Shared subtasks are stored server-side in `app/data/subtasks.csv` by default and are served through `/api/subtasks`, so every user connected to the same running app sees the same subtasks.

For production, run this as a Next.js server rather than a static export:

```bash
bun run build
bun run start
```

Set `CALIFY_DATA_DIR` to a durable writable directory when deploying, for example a mounted volume. When that directory contains `events.csv`, the app uses it for calendar events; subtasks are always read from and written to `subtasks.csv` in that directory. GitHub Pages cannot host the shared subtask API because it only serves static files.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
