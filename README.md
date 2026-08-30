# AI Recruitment Automation MVP

A working starter MVP with Next.js, TypeScript, FastAPI, PostgreSQL, resume parsing, evidence-based scoring, AI-style natural-language filters and recruiter-confirmed shortlisting.

## Included

- Demo recruiter login and company-scoped records
- Job creation with must-have and good-to-have skills
- Batch upload of up to 200 PDF/DOCX resumes
- Deterministic extraction of name, email, phone, skills, education and stated experience
- Eligibility rules, Estimated Match Score and evidence/reasons
- Ranked candidate dashboard and shortlist toggle
- Hinglish/English command filters such as `Top 10 candidates with 3 years and React`
- Docker Compose setup

## Run

```bash
cp .env.example .env
docker compose up --build
```

Open http://localhost:3000

Demo credentials:

```text
admin@example.com
admin123
```

API docs: http://localhost:8000/docs

## Important MVP boundaries

- Resume extraction is deterministic and does not invent missing values.
- This starter does not send LinkedIn or WhatsApp messages.
- Add official APIs, candidate opt-in and recruiter approval before enabling communication.
- Change demo credentials and JWT secret before any deployment.
- Production setup still needs malware scanning, encryption, backups, rate limits, privacy/retention controls, proper password hashing and audit logs.
