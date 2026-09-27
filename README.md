# PROMPTRIX - Prompt Engineering & Model Routing Hub

> **Project Status**: 🟡 `Completed Prototype / Showcase`  
> **Tech Stack**: React 18, TypeScript, Vite, Tailwind CSS, Supabase (Auth/Database), OpenRouter API, Server-Sent Events (SSE)  
> **Architecture**: Full-stack prompt engineering hub with streaming chat, version-controlled prompt sharing, and multi-model routing

A modern workspace for authoring, evaluating, versioning, and sharing AI prompts across frontier LLM models.

---

## 🌟 Key Features

- **Multi-Model Routing via OpenRouter**: Seamlessly route prompts across leading AI models (GPT-4o, Claude 3.5 Sonnet, Gemini Pro, Llama 3) from a unified interface.
- **Real-Time Streaming**: High-throughput Server-Sent Events (SSE) chat streaming with markdown tables, code syntax highlighting, and chunk parsing.
- **Version Control & Sharing**: Slug-based public sharing with version histories, forking, and copy permissions.
- **Prompt Library Management**: Tagging, categorization, search filtering, and use-case taxonomies.
- **Security & Reliability**: Built-in IP rate limiting, request correlation IDs, structured logging, and CORS validation.

---

## 🛠️ Architecture

```
├── src/
│   ├── components/         # Shadcn & custom prompt/chat UI elements
│   ├── integrations/       # Supabase typed database client
│   ├── pages/              # Index, Prompt Library, Chat, Settings
│   └── types/              # Type definitions for prompts, models, sessions
├── supabase/               # Migrations, Edge Functions, Schema DDL
└── .env.example            # Environment configuration template
```

---

## 🚀 Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/faisaladi/promptrix.git
cd promptrix
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase project credentials and OpenRouter API key:
```env
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_URL="https://your-project-ref.supabase.co"
OPENROUTER_API_KEY="sk-or-your-key"
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) (or the displayed Vite port) in your browser.

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.
