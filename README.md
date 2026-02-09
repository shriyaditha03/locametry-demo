# LocaMetry - Locate and Measure Property

LocaMetry is a free, open-source, map-based web application that allows users to select ANY location on a map, automatically populate the complete address for that location, and measure property dimensions such as length, width, area (sqft), and perimeter.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Maps**: Leaflet + OpenStreetMap
- **Geocoding**: OSM Nominatim (Server-side + Cached)
- **Database**: PostgreSQL (Local/Docker) + Prisma
- **Calculations**: Turf.js
- **Styling**: Tailwind CSS

## Prerequisites
- Node.js 18+
- Docker & Docker Compose (for local database)

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Database**
   ```bash
   docker-compose up -d
   ```

3. **Setup Database Schema**
   ```bash
   # Create a .env file with your DB URL (default provided in project)
   # DATABASE_URL="postgresql://postgres:password@localhost:5432/locametry?schema=public"
   
   npx prisma migrate dev --name init
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the result.

## Measurement Modes
- **RECT3**: Calculate rectangle area by selecting 3 points (inferred 4th point).
- **FOUR**: Define a rectangle/quadrilateral by selecting 4 points.
- **POLY**: Measure irregular shapes by selecting N points.

## Vercel Deployment
The app is designed to be compatible with Vercel. 
- If no `DATABASE_URL` is provided, the app falls back to **read-only mode**.
- Map, search, and measurement features will still work!
- Saving surveys requires a PostgreSQL database.

## Critical Notes
- **Nominatim Use**: Requests are server-side and rate-limited to 1 req/sec to respect OSM terms of service.
- **Free Everything**: No paid APIs or services are used.
