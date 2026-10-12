# Mentaura CA Residential Campus — Online Assessment & Evaluation System

Official Assessment Portal for **Mentaura CA Residential Campus** ([mentauraca.info](https://mentauraca.info/)).
Web platform for publishing CA question papers, student handwritten PDF answer submissions, admin reviewer assignment, and question-wise faculty evaluation.

**Campus Details:**
- **Website:** [https://mentauraca.info/](https://mentauraca.info/)
- **Location:** Kadalikadu P.O., Manjalloor, Vazhakulam, Ernakulam, Kerala
- **Phone:** +91 6282955052
- **Email:** mentauraca@gmail.com
- **Programs:** CA Intermediate, CA Final, Crash Courses & Test Series

## Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Storage:** Local JSON database + file uploads (MVP; ready to migrate to Supabase later)

## Quick start

```bash
# from project root
npm install
npm run install:all
npm run seed
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:4000  

## Production build & run

```bash
# build client bundle
npm run build

# start unified server (serves API + client)
npm start
```

Open: http://localhost:4000

## Demo accounts

| Role     | Email                     | Password     |
|----------|---------------------------|--------------|
| Admin    | admin@caacademy.com       | admin123     |
| Student  | student@caacademy.com     | student123   |
| Reviewer | reviewer@caacademy.com    | reviewer123  |

## End-to-end workflow

1. Public user browses **Question Papers**
2. Student logs in → **Attempt** → uploads answer PDF
3. Admin opens **Assign reviews** → assigns reviewer
4. Reviewer opens assignment → marks + feedback
5. Student views **Result**

## Project structure

```
CA_Test series/
  client/     React app
  server/     Express API
  package.json
```
