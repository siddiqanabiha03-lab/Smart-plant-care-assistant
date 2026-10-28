# Smart Plant Care Assistant 🌿

A beginner-friendly full-stack project with a polished responsive dashboard.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express
- Database: Supabase (PostgreSQL)
- API: REST endpoints served by Express

## Features
- Dashboard with plant count, plants needing water, and care score
- Add, view, water, and delete plants
- Search and filter plant collection
- Care tips based on plant type and watering interval
- Responsive UI with sample/demo mode when backend credentials are not configured
- Backend input validation and parameterized Supabase client calls

> This is a software-only care assistant. Watering reminders and recommendations are estimates, not sensor readings or professional horticultural advice.

## Folder structure
```text
smart-plant-care-assistant/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── server.js
├── supabase/
│   └── schema.sql
└── README.md
```

## 1. Create the Supabase database
1. Create a project at https://supabase.com.
2. Open **SQL Editor** in the Supabase dashboard.
3. Paste and run `supabase/schema.sql`.
4. From **Project Settings → API**, copy the Project URL and `service_role` key.
5. Keep the service role key private. Never put it in frontend files or commit it to Git.

## 2. Configure and start the backend
Install Node.js 18 or newer. In a terminal:

```bash
cd backend
npm install
```

Copy `.env.example` to `.env`, then fill in:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PORT` (optional; defaults to 3000)
- `FRONTEND_ORIGIN` (optional; defaults to http://localhost:5500)

Start the API:

```bash
npm run dev
```

The API health check is `http://localhost:3000/api/health`.

## 3. Run the frontend
Serve the `frontend` folder using a local static server. For example, with VS Code's Live Server, open `frontend/index.html` and choose **Open with Live Server**. The default Live Server port (5500) matches the backend's default CORS origin.

Alternatively, from the project root run:
```bash
npx serve frontend -l 5500
```

The frontend uses `http://localhost:3000/api` by default. If needed, change `API_BASE` at the top of `frontend/app.js`.

## Demo mode
If the backend is unreachable or not configured, the UI falls back to browser-local demo data so you can explore the interface. Demo changes are stored in `localStorage` and do not reach Supabase. A status pill indicates whether the UI is connected to the API or in demo mode.

## API endpoints
- `GET /api/health` — API and database configuration status
- `GET /api/plants` — list plants; optional `?search=...&status=...`
- `POST /api/plants` — create a plant
- `PATCH /api/plants/:id/water` — record watering and calculate next watering date
- `DELETE /api/plants/:id` — delete a plant
- `GET /api/tips` — care tips

## Plant fields
- `name` (required)
- `species` (required)
- `location` (required)
- `light` (`low`, `indirect`, `bright`, `direct`)
- `water_interval_days` (integer from 1 to 60)
- `notes` (optional)

## Troubleshooting
- **Cannot connect:** ensure the backend is running on port 3000 and visit `/api/health`.
- **Supabase error:** verify the project URL/key and run the SQL schema.
- **CORS error:** ensure `FRONTEND_ORIGIN` exactly matches the frontend origin, including port.
- **Demo mode:** the frontend is designed to remain usable if the API is unavailable; check the backend terminal and environment values to connect the database.

## Security notes
This starter uses the Supabase service role key on the server only. Do not expose it to browser JavaScript. For a public production deployment, add authentication, user ownership policies, rate limiting, logging, and deployment-specific environment configuration before exposing write endpoints.
