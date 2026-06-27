# AGENTS.md

## Project

React 19 + TypeScript 6 + Electron 42 desktop quiz app. Users upload Word/TXT/JSON/MD question banks, the app parses them and presents quizzes. Single package, no monorepo.

**Entry points:** `src/main.tsx` → `src/App.tsx` (HashRouter + lazy-loaded pages), `electron/main.cjs` (Electron main process).

## Commands

```bash
npm run dev              # Vite dev server at localhost:5173
npm run electron:dev     # Electron desktop mode (spawns Vite, polls readiness)
npm run build            # tsc -b && vite build → dist/
npm run lint             # ESLint (flat config, ignores dist/release/node_modules)
npm run lint:fix         # ESLint --fix
npm run test             # vitest run (unit tests, jsdom env)
npm run test:e2e         # Playwright test (auto-starts dev server)
npm run test:pytest      # pytest tests/ (Python converter tests)
npm run test:all         # all three sequentially
```

## Code quality gate

Run before committing: `npm run lint && npm run test`

CI (`.github/workflows/ci.yml`) runs lint, test, and build as separate jobs on ubuntu-latest / Node 18.

## TypeScript quirks

`tsconfig.app.json` enables `verbatimModuleSyntax: true` — you **must** use `import type { X }` for type-only imports. Plain `import { X }` for a type will fail the build.

Also enabled: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`.

## React Compiler

`babel-plugin-react-compiler` is in devDependencies and configured via `@vitejs/plugin-react`. Components are auto-memoized — manual `useMemo`/`useCallback` is generally unnecessary unless the compiler bailout message appears in the console.

## Testing

- **Unit (vitest):** `src/__tests__/*.test.{ts,tsx}`. Setup file: `src/test/setup.ts` (imports `@testing-library/jest-dom` and `src/test/mocks/pdfjs`).
- **E2E (Playwright):** `e2e/*.spec.ts`. Hardcoded to `channel: 'msedge'` — will fail on machines without Edge. Playwright auto-launches Vite dev server before tests.
- **Pre-commit hook** (`.husky/pre-commit`): runs `npm test` (full vitest suite). Note: `lint-staged` config exists in package.json but is **not wired** to the hook — pre-commit does NOT run eslint.

## Electron dual-mode

- **Dev:** `electron/main.cjs` spawns `npx vite`, polls `localhost:5173` with 30s timeout, then `loadURL`.
- **Packaged:** loads `dist/index.html` directly via `loadFile`. No Vite dependency.
- **File converter:** `electron/python-converter.exe` (PyInstaller-bundled). In dev, loaded from `electron/`; when packaged, from `app.asar.unpacked/electron/`.

## Packaging gotchas (Windows)

- `npm run electron:build:win` often hangs at ia32+NSIS. Quick rebuild: `npx electron-builder --dir --win --x64` (unpacked only).
- EPERM on dll files → kill lingering process: `Get-Process SelfQuiz | Stop-Process -Force`
- `win-unpacked/` dir is directly runnable after `npm run build` — no installer needed for dev.

## Key architecture

- **Parser engine:** `src/utils/parsers/` — two-phase: `collectQuestions()` (boundary detection) → `extractQuestion()` (structured extraction). Word/PDF/XLSX parsing delegated to Electron's Python converter via IPC.
- **State:** Three nested Context Providers: `PreferencesProvider > QuestionBankProvider > QuizProvider`.
- **Persistence:** All localStorage. Keys: `quiz_stats`, `wrong_questions`, `bookmarked_questions`, `quiz_progress`, `question_banks`, `active_bank`.
- **Router:** HashRouter (`/#/path`). Routes: `/` (home), `/quiz`, `/result`, `/stats`, `/upload`.

## Notes

- `README.md` and `PLAN.md` may be stale — source code is the source of truth.
- No built-in question banks — users must upload their own.
- `src/data/` directory exists but is empty.
- `styles-backup/` at repo root contains older CSS/component versions (not used by the app).
- Root-level `main.cjs` is an older copy; `electron/main.cjs` is the canonical one referenced by package.json.
