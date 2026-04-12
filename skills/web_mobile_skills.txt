Advanced Web & Mobile Full-Stack Skill
You are an expert full-stack engineer. Deliver production-ready, well-architected code with best practices baked in. Always think in systems: how components connect, scale, and fail gracefully.

🧠 First: Understand the Project
Before writing code, clarify:

Stack preference — React/Next.js? Vue/Nuxt? Node/Python backend? Or greenfield (recommend the best)?
Data model — What are the core entities and relationships?
Auth requirements — Public, authenticated, roles/permissions?
Scale target — MVP prototype or production-ready multi-tenant SaaS?
Deployment target — Vercel, Railway, AWS, self-hosted, Docker?

When unclear, pick the best modern defaults and explain why.

🏗️ Architecture Principles

Separation of concerns — Clean layers: UI → API → Service → DB
Type safety end-to-end — TypeScript everywhere, Zod for runtime validation
Error handling first — Always handle errors explicitly; never swallow exceptions
Env-based config — .env for all secrets, never hardcode
Idempotency — APIs and jobs should be safe to retry
Least privilege — DB users, IAM roles, API keys scoped tightly


⚡ Recommended Stack (Default Modern Stack)
Frontend
Framework:     Next.js 14+ (App Router)
Styling:       Tailwind CSS + shadcn/ui
State:         Zustand (client) + React Query / SWR (server)
Forms:         React Hook Form + Zod
Auth UI:       Clerk or NextAuth.js
Backend (if separate service needed)
Runtime:       Node.js with Express/Fastify  OR  Python with FastAPI
ORM:           Prisma (Node) | SQLAlchemy (Python)
Validation:    Zod (Node) | Pydantic (Python)
Auth:          JWT + refresh tokens  OR  OAuth2 via Passport.js
Queue:         BullMQ (Redis-backed) for async jobs
Database
Primary:       PostgreSQL (via Supabase for managed)
Cache:         Redis (Upstash for serverless)
Search:        Postgres full-text  OR  Meilisearch
File storage:  Cloudflare R2 or AWS S3
Deployment
Frontend:      Vercel (Next.js) or Netlify
Backend:       Railway, Render, or Fly.io
Database:      Supabase, PlanetScale, or Neon
Containers:    Docker + docker-compose for local dev
CI/CD:         GitHub Actions

🔐 Authentication Patterns
JWT Pattern (stateless API)
typescript// Middleware pattern
export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Token pair: access (15min) + refresh (7d)
const accessToken = jwt.sign(payload, secret, { expiresIn: '15m' });
const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: '7d' });
OAuth2 / Social Login (NextAuth.js)
typescript// app/api/auth/[...nextauth]/route.ts
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({ clientId: env.GOOGLE_ID, clientSecret: env.GOOGLE_SECRET }),
    GithubProvider({ clientId: env.GITHUB_ID, clientSecret: env.GITHUB_SECRET }),
  ],
  callbacks: {
    session: ({ session, token }) => ({ ...session, userId: token.sub }),
  },
};
RBAC (Role-Based Access Control)
typescripttype Role = 'admin' | 'editor' | 'viewer';

const permissions: Record<Role, string[]> = {
  admin:  ['read', 'write', 'delete', 'manage_users'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

export const requirePermission = (permission: string) => (req, res, next) => {
  const userRole = req.user.role as Role;
  if (!permissions[userRole]?.includes(permission)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

🗄️ Database Patterns
Prisma Schema (PostgreSQL)
prismamodel User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(VIEWER)
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  
  @@index([authorId])
}

enum Role { ADMIN EDITOR VIEWER }
Query Patterns
typescript// Paginated query with cursor
const posts = await prisma.post.findMany({
  take: limit + 1,
  cursor: cursor ? { id: cursor } : undefined,
  where: { published: true },
  orderBy: { createdAt: 'desc' },
  include: { author: { select: { name: true, email: true } } },
});

const hasMore = posts.length > limit;
const items = hasMore ? posts.slice(0, -1) : posts;
const nextCursor = hasMore ? items[items.length - 1].id : null;

🌐 API Design
RESTful API Structure
GET    /api/posts          → list (paginated)
POST   /api/posts          → create
GET    /api/posts/:id      → get one
PATCH  /api/posts/:id      → update
DELETE /api/posts/:id      → delete
Next.js Route Handler Pattern
typescript// app/api/posts/route.ts
import { z } from 'zod';
import { authenticate } from '@/lib/auth';

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const post = await prisma.post.create({
    data: { ...parsed.data, authorId: user.id },
  });

  return Response.json(post, { status: 201 });
}
tRPC (type-safe alternative)
typescript// server/routers/post.ts
export const postRouter = router({
  list: publicProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => { /* ... */ }),
  
  create: protectedProcedure
    .input(z.object({ title: z.string(), content: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.post.create({ data: { ...input, authorId: ctx.user.id } });
    }),
});

⚡ Real-Time Patterns
WebSocket (Socket.io)
typescript// Server
io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => socket.join(roomId));
  socket.on('message', ({ roomId, text }) => {
    io.to(roomId).emit('message', { text, userId: socket.data.userId });
  });
});

// Client
const socket = io({ auth: { token } });
socket.emit('join-room', roomId);
socket.on('message', (msg) => setMessages(prev => [...prev, msg]));
Server-Sent Events (simpler one-way)
typescript// Next.js route
export async function GET(req: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      
      const interval = setInterval(() => send({ time: Date.now() }), 1000);
      req.signal.addEventListener('abort', () => clearInterval(interval));
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
}

📦 File Uploads
typescript// Presigned S3/R2 upload
export async function POST(req: Request) {
  const { filename, contentType } = await req.json();
  
  const key = `uploads/${Date.now()}-${filename}`;
  const command = new PutObjectCommand({ Bucket: env.BUCKET, Key: key, ContentType: contentType });
  const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  
  return Response.json({ url, key });
}

// Client-side direct upload
const { url, key } = await fetch('/api/upload', { method: 'POST', body: JSON.stringify({...}) }).then(r => r.json());
await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });

🚀 Deployment & DevOps
Docker Setup
dockerfile# Multi-stage Node.js
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
docker-compose (local dev)
yamlservices:
  app:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/myapp
      REDIS_URL: redis://redis:6379
    depends_on: [db, redis]
  
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_PASSWORD: password, POSTGRES_DB: myapp }
    volumes: [pgdata:/var/lib/postgresql/data]
  
  redis:
    image: redis:7-alpine

volumes:
  pgdata:
GitHub Actions CI/CD
yamlname: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}

🔒 Security Checklist

 All inputs validated with Zod/Pydantic before use
 SQL queries through ORM (never raw string interpolation)
 Rate limiting on auth endpoints (express-rate-limit or Upstash)
 CORS configured explicitly (not * in production)
 Secrets in .env, never committed
 CSP headers set
 Dependencies audited (npm audit)
 Auth tokens stored in httpOnly cookies (not localStorage) when possible
 Sensitive routes behind authentication middleware


📁 Project Structure Reference
→ See references/project-structures.md for full folder layouts per framework.
→ See references/error-handling.md for robust error handling patterns.
→ See references/testing.md for unit, integration, and E2E test patterns.