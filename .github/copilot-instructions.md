# Copilot Instructions for app.famly.ai

## Project Overview
- This is a Vite + React web application, originally exported from Base44, now maintained under the `casepruis` GitHub account.
- The app explores AI-driven, family-oriented productivity and UX features.
- Main entry: `src/main.jsx`, with app shell in `src/App.jsx`.
- API integrations and business logic are in `src/api/` and `src/lib/`.
- UI components are organized by domain in `src/components/` (e.g., `ai/`, `chat/`, `dashboard/`, `schedule/`).
- Static assets are in `public/`.

## Key Workflows
- **Install dependencies:** `npm install`
- **Start dev server:** `npm run dev`
- **Build for production:** `npm run build`
- **Main config files:** `vite.config.js`, `tsconfig.json`, `tailwind.config.js`, `eslint.config.js`

## Patterns & Conventions
- Use React functional components and hooks (see `src/hooks/`).
- UI logic is modularized by feature domain (e.g., `src/components/chat/`, `src/components/schedule/`).
- API clients are in `src/api/` (e.g., `authClient.js`, `base44Client.js`).
- Utility functions are in `src/lib/utils.js` and `src/utils/`.
- TypeScript is used for some files (e.g., `integrations.ts`, `utils/index.ts`), but most code is JavaScript/JSX.
- Tailwind CSS is used for styling (see `tailwind.config.js`).
- No Redux; state is managed locally or via React context/providers (see `src/components/common/LanguageProvider.jsx`).

## Integration & Communication
- External API endpoints are accessed via clients in `src/api/`.
- Cross-component communication is via props, context, or custom hooks.
- Service worker (`public/sw.js`) is present for PWA or notification features.

## Examples
- To add a new dashboard widget, create a component in `src/components/dashboard/` and import it in `Dashboard.jsx`.
- For a new API integration, add a client in `src/api/` and use it in the relevant feature module.

## Special Notes
- The project is evolving; some files may be legacy from Base44 export (see `famlyai-1eac46be/`).
- For questions, see `README.md` or contact Base44 support at app@base44.com.

---

_If any conventions or workflows are unclear, please ask for clarification or suggest updates to this file._
