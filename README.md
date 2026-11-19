# ResumeMatch AI

**Paste your resume and a job description to get an AI-generated match report: scores, missing keywords, an ATS check and rewritten bullets.**

🔗 **Live demo:** https://reumematchai.netlify.app

![ResumeMatch AI screenshot](docs/screenshot.png)
<!-- Add a screenshot or GIF at docs/screenshot.png -->

---

## ✨ Features

- **Match score (0–100)** with a one-line verdict
- **ATS compatibility score (0–100)** with a list of concrete ATS issues
- **Keyword analysis:** matched keywords, plus missing ones tagged *critical* or *nice to have*
- **Section-by-section feedback:** summary, experience, skills, education, projects
- **Bullet rewrites:** weak bullets rewritten into stronger ones, with a reason for each change and a one-click **Copy** button
- **Prioritized suggestions** and highlighted **red flags**
- **PDF upload:** text is extracted in the browser with pdfjs-dist. Scanned or image-only PDFs are detected and reported.
- Live character counters, validation, rotating loading messages and a **Try with sample data** button
- Light and dark mode, responsive down to 360px, keyboard accessible, and respects `prefers-reduced-motion`

## 🧰 Tech stack

![React](https://img.shields.io/badge/React_18-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Netlify](https://img.shields.io/badge/Netlify_Functions-00C7B7?logo=netlify&logoColor=white)
![Node.js](https://img.shields.io/badge/Node_20-339933?logo=nodedotjs&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?logo=googlegemini&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=githubactions&logoColor=white)
![CSS](https://img.shields.io/badge/Plain_CSS-1572B6?logo=css3&logoColor=white)

| Layer       | Choice                                                            |
| ----------- | ----------------------------------------------------------------- |
| Frontend    | React 18 + Vite, plain CSS with custom properties (no UI library) |
| PDF parsing | `pdfjs-dist` (client-side, lazy-loaded)                           |
| Backend     | Netlify Functions (Node 20, ES modules)                           |
| LLM         | Google Gemini REST API via `fetch` (no SDK)                       |
| Hosting     | Netlify                                                           |
| CI/CD       | GitHub Actions → Netlify CLI                                      |

## 🏗️ Architecture

```mermaid
flowchart LR
  subgraph Runtime
    U[User's browser<br/>React + Vite] -- "POST /.netlify/functions/analyze" --> F[Netlify Function<br/>analyze.mjs]
    F -- "REST + GEMINI_API_KEY" --> G[(Google Gemini API)]
    G -- JSON report --> F
    F -- validated JSON --> U
  end

  subgraph Delivery
    D[Developer] -- git push --> GH[GitHub repo]
    GH --> GA[GitHub Actions<br/>npm ci → build]
    GA -- "netlify deploy" --> N[Netlify<br/>static site + functions]
  end
```

## 📁 Project structure

```
.
├── .github/workflows/deploy.yml   # CI/CD: prod deploy on main, draft preview on PRs
├── netlify/functions/analyze.mjs  # Serverless function: validation, rate limit, Gemini call
├── public/favicon.svg
├── src/
│   ├── components/                # InputPanel, ScoreRing, KeywordChips, SectionFeedback,
│   │                              # BulletRewrites, Suggestions, Results
│   ├── lib/api.js                 # Calls the function, handles errors and timeouts
│   ├── lib/pdf.js                 # PDF text extraction
│   ├── lib/sample.js              # Sample resume + JD
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── netlify.toml
└── vite.config.js
```

## 💻 Local setup

**Prerequisites:** Node.js 20 or later, plus a free [Gemini API key](https://aistudio.google.com/app/apikey).

```bash
# 1. Clone
git clone https://github.com/<your-username>/ResumeMatchAI.git
cd ResumeMatchAI

# 2. Install
npm install

# 3. Configure environment
cp .env.example .env
# then edit .env and set GEMINI_API_KEY=your-key

# 4. Run the app and the function together
npm run netlify:dev
```

Open **http://localhost:8888**.

> `npm run dev` starts only the Vite frontend (port 5173), so the `/.netlify/functions/analyze` endpoint won't exist. Use `npm run netlify:dev` for the full app. Netlify Dev reads `.env` automatically.

## 🚀 Deployment (GitHub Actions → Netlify)

1. **Get a Gemini API key.** Create a free key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. **Push the project to GitHub.** Create a new repository and push this code to the `main` branch.
3. **Create a Netlify site.** Use one of these:
   - **CLI:** `npx netlify login`, then `npx netlify sites:create --name your-site-name`
   - **Dashboard:** *Add new site → Deploy manually* (drag in any folder, such as `dist`).
     ⚠️ Don't choose "Import from Git". GitHub Actions should be the only thing that deploys, otherwise every push builds twice.
4. **Copy the Site ID.** It's under Netlify → *Site configuration → Site details → Site ID*.
5. **Create a personal access token.** Go to Netlify → *User settings → Applications → Personal access tokens → New access token*.
6. **Add GitHub secrets.** In the repo, open *Settings → Secrets and variables → Actions → New repository secret* and add:
   - `NETLIFY_AUTH_TOKEN`: the token from step 5
   - `NETLIFY_SITE_ID`: the Site ID from step 4
7. **Add Netlify environment variables.** In Netlify → *Site configuration → Environment variables*, add:
   - `GEMINI_API_KEY`: your Gemini key (required)
   - `GEMINI_MODEL`: optional, defaults to `gemini-flash-latest`

   The Gemini key goes in **Netlify, not GitHub**, because the function runs on Netlify.
8. **Deploy.** Push to `main`, watch the **Actions** tab, then open your `https://<site>.netlify.app` URL. Pull requests to `main` get a draft preview deploy, and its URL is posted on the PR.

### 🩺 Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| **401 / "Unauthorized"** in the Actions deploy step | `NETLIFY_AUTH_TOKEN` is wrong, expired or missing. Create a new token and update the GitHub secret. |
| **"Site not found"** in Actions | `NETLIFY_SITE_ID` is wrong. Copy it again from Site details. |
| **Function returns 500 "not configured"** | `GEMINI_API_KEY` isn't set in Netlify's environment variables. Add it and redeploy, because env changes only apply to new deploys. |
| **404 on `/.netlify/functions/analyze`** | The functions path is wrong. It must be `netlify/functions` in both `netlify.toml` and the `--functions` flag. Locally, use `npm run netlify:dev`. |
| **502 "AI service returned an error"** | The key is invalid or the model name is wrong. Check the function logs in Netlify → *Logs → Functions*. |
| **CORS errors** | These shouldn't happen, because the frontend and the function share an origin. If you see one, you're probably calling the function from a different domain. |

## 🔐 Security notes

- **The API key stays in a serverless function.** The browser only calls `/.netlify/functions/analyze`. The Gemini key is read from `process.env` on the server, sent to Google in a request header (never in the URL), and never included in the frontend bundle or the Git history (`.env` is git-ignored).
- **Input validation:** POST only (other methods get 405). Both fields are required, the resume must be 200–15,000 characters and the job description 100–10,000. Invalid input gets a clear 400.
- **Rate limiting:** 10 requests per IP per 10 minutes, with a friendly 429. This runs in memory, so it is best-effort only: counters reset on cold starts and aren't shared between instances.
- **Prompt-injection handling:** The resume and job description are wrapped in delimiters, delimiter sequences in user text are stripped, and the prompt tells the model to treat both strictly as data and ignore instructions inside them. The output is parsed as JSON, checked against the expected shape (with safe defaults for anything missing) and scores are clamped to 0–100, so a manipulated response can't break the UI.
- **Safe errors:** Clients only get clean JSON error messages, never stack traces or upstream details. Full errors are logged server-side with `console.error`.
- **Timeouts:** The Gemini call is aborted after 20 seconds and the client gives up after 40 seconds.
- **Privacy:** Nothing is stored. Data goes to Gemini for analysis only.

## 🛣️ Future improvements

- User accounts and authentication
- Saved analysis history
- DOCX resume upload
- Pluggable LLM providers (OpenAI, Anthropic, local models)
- Durable rate limiting backed by a database or Redis
- Export the report as PDF

## 📄 License

MIT © Harish Kumar
