# ✅ VibeCoding DeepStation — Todo App

A clean, minimal **To-Do List** web app built with **Next.js 15**, **TypeScript**, and **Tailwind CSS**. Tasks are tracked with timestamps showing when each was created. Database persistence coming soon.

---

## 🚀 Tech Stack

- **[Next.js 15](https://nextjs.org/)** — React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[React 19](https://react.dev/)** — UI library

---

## ✨ Features

- Add tasks by typing and pressing **Enter** or clicking **Add**
- Mark tasks as **complete** with a single click
- **Delete** tasks on hover
- Each task shows a **"Added on" timestamp**
- Live task counter — see how many tasks remain
- **Clear completed** button to bulk-remove finished tasks
- Fully responsive — works on mobile and desktop

---

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/VibeCoding_DeepStation.git
cd VibeCoding_DeepStation

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
VibeCoding_DeepStation/
├── app/
│   ├── globals.css       # Tailwind base styles
│   ├── layout.tsx        # Root layout & metadata
│   └── page.tsx          # Main Todo app component
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run lint` | Run ESLint |

---

## 🗺️ Roadmap

- [x] Add tasks with timestamps
- [x] Mark tasks complete / incomplete
- [x] Delete tasks
- [x] Clear all completed tasks
- [ ] Persist tasks with a database (Postgres / Supabase)
- [ ] User authentication
- [ ] Multiple lists / categories
- [ ] Due dates and priorities

---

## 📄 License

MIT — free to use and modify.
