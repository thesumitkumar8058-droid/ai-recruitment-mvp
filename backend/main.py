import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List

import fitz
from docx import Document
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, String, Text, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://recruitment:recruitment@localhost:5432/recruitment")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
DEMO_EMAIL = os.getenv("DEMO_EMAIL", "admin@example.com")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "admin123")
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass

class Company(Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(30), default="admin")

class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text, default="")
    min_experience: Mapped[float] = mapped_column(Float, default=0)
    must_skills: Mapped[list] = mapped_column(JSON, default=list)
    good_skills: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Candidate(Base):
    __tablename__ = "candidates"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    experience_years: Mapped[float] = mapped_column(Float, default=0)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    education: Mapped[str] = mapped_column(String(200), default="Not mentioned")
    resume_path: Mapped[str] = mapped_column(String(500))

class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True)
    eligible: Mapped[bool] = mapped_column(Boolean, default=False)
    score: Mapped[float] = mapped_column(Float, default=0)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    shortlisted: Mapped[bool] = mapped_column(Boolean, default=False)

Base.metadata.create_all(engine)
app = FastAPI(title="AI Recruitment MVP", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://ai-recruitment-mvp-psi.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

class LoginIn(BaseModel):
    email: str
    password: str

class JobIn(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    description: str = ""
    min_experience: float = Field(default=0, ge=0)
    must_skills: List[str] = Field(default_factory=list)
    good_skills: List[str] = Field(default_factory=list)

class CommandIn(BaseModel):
    command: str = Field(min_length=1, max_length=500)

def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed(db: Session):
    company = db.query(Company).first()
    if not company:
        company = Company(name="Demo Company")
        db.add(company)
        db.commit()
        db.refresh(company)
    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if not user:
        user = User(company_id=company.id, email=DEMO_EMAIL, role="admin")
        db.add(user)
        db.commit()
        db.refresh(user)
    return company

def token_for(user: User):
    payload = {"sub": str(user.id), "company_id": user.company_id, "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def current_user(creds: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(db_session)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
        user = db.get(User, int(payload["sub"]))
        if not user or user.company_id != int(payload["company_id"]):
            raise ValueError()
        return user
    except (JWTError, ValueError, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def owned_job(db: Session, job_id: int, company_id: int):
    job = db.query(Job).filter(Job.id == job_id, Job.company_id == company_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

SKILLS = ["React", "Node.js", "TypeScript", "JavaScript", "Python", "Java", "FastAPI", "Django", "SQL", "PostgreSQL", "MongoDB", "AWS", "Azure", "Docker", "Kubernetes", "Git", "Next.js", "HTML", "CSS", "Figma"]

def extract_text(path: Path):
    if path.suffix.lower() == ".pdf":
        with fitz.open(path) as document:
            return "\n".join(page.get_text() for page in document)
    if path.suffix.lower() == ".docx":
        document = Document(path)
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    raise ValueError("Only PDF and DOCX are supported")

def parse_resume(text: str, filename: str):
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    compact_text = text.replace(" ", "")
    phone = re.search(r"(?:\+?91[-\s]?)?[6-9]\d{9}", compact_text)
    experience_matches = re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)", text, re.I)
    years = max([float(value) for value in experience_matches], default=0)
    found_skills = [skill for skill in SKILLS if re.search(rf"(?<!\w){re.escape(skill)}(?!\w)", text, re.I)]
    degrees = ["M.Tech", "B.Tech", "MCA", "BCA", "MBA", "B.E.", "B.Sc", "M.Sc"]
    education = next((degree for degree in degrees if degree.lower() in text.lower()), "Not mentioned")
    name = next((line.strip() for line in text.splitlines() if 2 <= len(line.strip()) <= 60), Path(filename).stem)
    return {"name": name, "email": email.group(0) if email else None, "phone": phone.group(0) if phone else None, "experience_years": years, "skills": found_skills, "education": education}

def score_candidate(candidate: Candidate, job: Job):
    candidate_skills = {skill.lower() for skill in candidate.skills}
    must_skills = {skill.lower() for skill in job.must_skills}
    good_skills = {skill.lower() for skill in job.good_skills}
    missing_skills = sorted(must_skills - candidate_skills)
    reasons = []
    if missing_skills:
        reasons.append("Missing mandatory skills: " + ", ".join(missing_skills))
    if candidate.experience_years < job.min_experience:
        reasons.append(f"Experience below {job.min_experience:g} years")
    eligible = not reasons
    must_ratio = len(must_skills & candidate_skills) / max(1, len(must_skills))
    good_ratio = len(good_skills & candidate_skills) / max(1, len(good_skills)) if good_skills else 1
    skill_score = (0.75 * must_ratio + 0.25 * good_ratio) * 100
    experience_score = min(100, candidate.experience_years / max(1, job.min_experience) * 100) if job.min_experience else 100
    score = round(0.70 * skill_score + 0.30 * experience_score, 1)
    matched_skills = sorted(candidate_skills & (must_skills | good_skills))
    reasons.extend(["Matched skills: " + (", ".join(matched_skills) if matched_skills else "None"), f"Experience found: {candidate.experience_years:g} years"])
    return eligible, score, reasons

def candidate_json(application: Application, candidate: Candidate, job: Job):
    return {"application_id": application.id, "candidate_id": candidate.id, "job_id": job.id, "job_title": job.title, "name": candidate.name, "email": candidate.email, "experience_years": candidate.experience_years, "skills": candidate.skills, "education": candidate.education, "eligible": application.eligible, "score": application.score, "reasons": application.reasons, "shortlisted": application.shortlisted}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/auth/login")
def login(data: LoginIn, db: Session = Depends(db_session)):
    seed(db)
    if data.email != DEMO_EMAIL or data.password != DEMO_PASSWORD:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    user = db.query(User).filter(User.email == data.email).first()
    return {"access_token": token_for(user), "token_type": "bearer", "user": {"email": user.email, "role": user.role}}

@app.get("/jobs")
def list_jobs(user: User = Depends(current_user), db: Session = Depends(db_session)):
    return db.query(Job).filter(Job.company_id == user.company_id).order_by(Job.id.desc()).all()

@app.post("/jobs")
def create_job(data: JobIn, user: User = Depends(current_user), db: Session = Depends(db_session)):
    job = Job(company_id=user.company_id, **data.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@app.put("/jobs/{job_id}")
def update_job(job_id: int, data: JobIn, user: User = Depends(current_user), db: Session = Depends(db_session)):
    job = owned_job(db, job_id, user.company_id)
    for key, value in data.model_dump().items():
        setattr(job, key, value)
    applications = db.query(Application).filter(Application.job_id == job.id, Application.company_id == user.company_id).all()
    for application in applications:
        candidate = db.get(Candidate, application.candidate_id)
        if candidate:
            application.eligible, application.score, application.reasons = score_candidate(candidate, job)
    db.commit()
    db.refresh(job)
    return job

@app.delete("/jobs/{job_id}")
def delete_job(job_id: int, user: User = Depends(current_user), db: Session = Depends(db_session)):
    job = owned_job(db, job_id, user.company_id)
    applications = db.query(Application).filter(Application.job_id == job.id, Application.company_id == user.company_id).all()
    candidate_ids = [application.candidate_id for application in applications]
    for application in applications:
        db.delete(application)
    db.flush()
    deleted_candidates = 0
    for candidate_id in candidate_ids:
        application_count = db.query(Application).filter(Application.candidate_id == candidate_id).count()
        if application_count == 0:
            candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.company_id == user.company_id).first()
            if candidate:
                try:
                    Path(candidate.resume_path).unlink(missing_ok=True)
                except OSError:
                    pass
                db.delete(candidate)
                deleted_candidates += 1
    db.delete(job)
    db.commit()
    return {"deleted": True, "job_id": job_id, "deleted_candidates": deleted_candidates}

@app.post("/jobs/{job_id}/resumes")
async def upload_resumes(job_id: int, files: List[UploadFile] = File(...), user: User = Depends(current_user), db: Session = Depends(db_session)):
    job = owned_job(db, job_id, user.company_id)
    if len(files) > 200:
        raise HTTPException(status_code=400, detail="MVP limit is 200 files per batch")
    results = []
    for file in files:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix not in [".pdf", ".docx"]:
            results.append({"file": file.filename, "error": "Unsupported type"})
            continue
        path = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
        path.write_bytes(await file.read())
        try:
            text = extract_text(path)
            parsed = parse_resume(text, file.filename or "Candidate")
            candidate = Candidate(company_id=user.company_id, resume_path=str(path), **parsed)
            db.add(candidate)
            db.flush()
            eligible, score, reasons = score_candidate(candidate, job)
            application = Application(company_id=user.company_id, job_id=job.id, candidate_id=candidate.id, eligible=eligible, score=score, reasons=reasons)
            db.add(application)
            db.commit()
            results.append({"file": file.filename, "candidate": candidate.name, "score": score})
        except Exception as exc:
            db.rollback()
            path.unlink(missing_ok=True)
            results.append({"file": file.filename, "error": str(exc)})
    return {"processed": len(results), "results": results}

@app.get("/jobs/{job_id}/candidates")
def candidates(job_id: int, user: User = Depends(current_user), db: Session = Depends(db_session)):
    job = owned_job(db, job_id, user.company_id)
    rows = db.query(Application, Candidate).join(Candidate, Candidate.id == Application.candidate_id).filter(Application.job_id == job.id, Application.company_id == user.company_id).order_by(Application.score.desc()).all()
    return [candidate_json(application, candidate, job) for application, candidate in rows]

@app.get("/candidates/{candidate_id}/resume")
def view_resume(candidate_id: int, user: User = Depends(current_user), db: Session = Depends(db_session)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id, Candidate.company_id == user.company_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    path = Path(candidate.resume_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Resume file not found")
    media_type = "application/pdf" if path.suffix.lower() == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return FileResponse(path=path, media_type=media_type, filename=f"{candidate.name}{path.suffix}", content_disposition_type="inline")

@app.patch("/applications/{application_id}/shortlist")
def shortlist(application_id: int, user: User = Depends(current_user), db: Session = Depends(db_session)):
    application = db.query(Application).filter(Application.id == application_id, Application.company_id == user.company_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    application.shortlisted = not application.shortlisted
    db.commit()
    return {"application_id": application.id, "shortlisted": application.shortlisted}

@app.get("/shortlisted")
def shortlisted_candidates(user: User = Depends(current_user), db: Session = Depends(db_session)):
    rows = db.query(Application, Candidate, Job).join(Candidate, Candidate.id == Application.candidate_id).join(Job, Job.id == Application.job_id).filter(Application.company_id == user.company_id, Application.shortlisted.is_(True)).order_by(Application.score.desc()).all()
    return [candidate_json(application, candidate, job) for application, candidate, job in rows]

@app.post("/jobs/{job_id}/ai-filter")
def ai_filter(job_id: int, data: CommandIn, user: User = Depends(current_user), db: Session = Depends(db_session)):
    owned_job(db, job_id, user.company_id)
    command = data.command.strip().lower()
    years = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)", command)
    limit_match = re.search(r"top\s+(\d+)", command)
    requested_skills = [skill for skill in SKILLS if skill.lower() in command]
    wants_eligible = "eligible" in command
    wants_shortlisted = "shortlist" in command
    if not any([years, limit_match, requested_skills, wants_eligible, wants_shortlisted]):
        raise HTTPException(status_code=400, detail="Filter samajh nahi aaya. Example: Top 10 candidates with 3 years and React")
    limit = int(limit_match.group(1)) if limit_match else 50
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="Top limit 1 se 100 ke beech hona chahiye")
    query = db.query(Application, Candidate).join(Candidate, Candidate.id == Application.candidate_id).filter(Application.job_id == job_id, Application.company_id == user.company_id)
    if years:
        query = query.filter(Candidate.experience_years >= float(years.group(1)))
    if wants_eligible:
        query = query.filter(Application.eligible.is_(True))
    if wants_shortlisted:
        query = query.filter(Application.shortlisted.is_(True))
    rows = query.order_by(Application.score.desc()).all()
    if requested_skills:
        filtered_rows = []
        for application, candidate in rows:
            candidate_skills = {skill.lower() for skill in candidate.skills}
            if all(skill.lower() in candidate_skills for skill in requested_skills):
                filtered_rows.append((application, candidate))
        rows = filtered_rows
    rows = rows[:limit]
    return {"interpreted_filters": {"minimum_experience": float(years.group(1)) if years else None, "skills": requested_skills, "eligible_only": wants_eligible, "shortlisted_only": wants_shortlisted, "limit": limit}, "candidate_ids": [candidate.id for _, candidate in rows]}

@app.get("/analytics")
def analytics(user: User = Depends(current_user), db: Session = Depends(db_session)):
    company_id = user.company_id
    total_jobs = db.query(func.count(Job.id)).filter(Job.company_id == company_id).scalar() or 0
    total_candidates = db.query(func.count(Candidate.id)).filter(Candidate.company_id == company_id).scalar() or 0
    total_applications = db.query(func.count(Application.id)).filter(Application.company_id == company_id).scalar() or 0
    eligible = db.query(func.count(Application.id)).filter(Application.company_id == company_id, Application.eligible.is_(True)).scalar() or 0
    shortlisted = db.query(func.count(Application.id)).filter(Application.company_id == company_id, Application.shortlisted.is_(True)).scalar() or 0
    average_score = db.query(func.avg(Application.score)).filter(Application.company_id == company_id).scalar() or 0
    jobs = db.query(Job).filter(Job.company_id == company_id).order_by(Job.id.desc()).all()
    by_job = []
    for job in jobs:
        job_query = db.query(Application).filter(Application.company_id == company_id, Application.job_id == job.id)
        job_average_score = job_query.with_entities(func.avg(Application.score)).scalar() or 0
        by_job.append({"job_id": job.id, "title": job.title, "candidates": job_query.count(), "eligible": job_query.filter(Application.eligible.is_(True)).count(), "shortlisted": job_query.filter(Application.shortlisted.is_(True)).count(), "average_score": round(float(job_average_score), 1)})
    return {"total_jobs": total_jobs, "total_candidates": total_candidates, "total_applications": total_applications, "eligible": eligible, "shortlisted": shortlisted, "average_score": round(float(average_score), 1), "by_job": by_job}

@app.get("/settings")
def settings(user: User = Depends(current_user), db: Session = Depends(db_session)):
    company = db.get(Company, user.company_id)
    return {"email": user.email, "role": user.role, "company": company.name if company else "Unknown"}
