'use client'

import * as React from 'react'
import {
  type ChangeEvent,
  useEffect,
  useState
} from 'react'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000'

type Job = {
  id: number
  title: string
  description: string
  min_experience: number
  must_skills: string[]
  good_skills: string[]
}

type Candidate = {
  application_id: number
  candidate_id: number
  job_id: number
  job_title?: string
  name: string
  email?: string
  experience_years: number
  skills: string[]
  education: string
  eligible: boolean
  score: number
  reasons: string[]
  shortlisted: boolean
}

type JobAnalytics = {
  job_id: number
  title: string
  candidates: number
  eligible: number
  shortlisted: number
  average_score: number
}

type Analytics = {
  total_jobs: number
  total_candidates: number
  total_applications: number
  eligible: number
  shortlisted: number
  average_score: number
  by_job: JobAnalytics[]
}

type Settings = {
  email: string
  role: string
  company: string
}

type Section =
  | 'dashboard'
  | 'jobs'
  | 'resumes'
  | 'shortlisted'
  | 'analytics'
  | 'settings'

type BusyAction =
  | 'login'
  | 'jobs'
  | 'save-job'
  | 'delete-job'
  | 'candidates'
  | 'upload'
  | 'shortlist'
  | 'filter'
  | 'resume'
  | 'shortlisted'
  | 'analytics'
  | null

const sections: Array<{
  id: Section
  label: string
}> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'resumes', label: 'Resumes' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' }
]

async function getErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const data = await response.json()

if (typeof data?.detail === 'string') {
      return data.detail
    }

if (typeof data?.message === 'string') {
      return data.message
    }
  } catch {
    // Response JSON format mein nahi tha.
  }

return fallback
}

export default function Page() {
  const [token, setToken] = useState('')

const [email, setEmail] = useState(
    'admin@example.com'
  )

const [password, setPassword] = useState(
    'admin123'
  )

const [activeSection, setActiveSection] =
    useState<Section>('dashboard')

const [theme, setTheme] =
    useState<'light' | 'dark'>('light')

const [jobs, setJobs] = useState<Job[]>([])
  const [jobId, setJobId] = useState(0)

const [candidates, setCandidates] =
    useState<Candidate[]>([])

const [
    shortlistedCandidates,
    setShortlistedCandidates
  ] = useState<Candidate[]>([])

const [analytics, setAnalytics] =
    useState<Analytics | null>(null)

const [settings, setSettings] =
    useState<Settings | null>(null)

const [
    visibleCandidateIds,
    setVisibleCandidateIds
  ] = useState<number[] | null>(null)

const [editingJobId, setEditingJobId] =
    useState<number | null>(null)

/*
   * Create Job form ko khaali rakha gaya hai,
   * taaki placeholder/watermark dikh sake.
   */
  const [title, setTitle] = useState('')

const [description, setDescription] =
    useState('')

const [
    minimumExperience,
    setMinimumExperience
  ] = useState<number | ''>('')

const [mustSkills, setMustSkills] =
    useState('')

const [goodSkills, setGoodSkills] =
    useState('')

const [filterCommand, setFilterCommand] =
    useState(
      'Top 10 candidates with 3 years and React'
    )

const [busy, setBusy] =
    useState<BusyAction>(null)

const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

function clearMessages() {
    setError('')
    setSuccess('')
  }

function authHeaders(
    includeJsonContentType = true
  ): HeadersInit {
    const result: Record<string, string> = {
      Authorization: `Bearer ${token}`
    }

if (includeJsonContentType) {
      result['Content-Type'] = 'application/json'
    }

return result
  }

function logout(message = '') {
    localStorage.removeItem('token')

setToken('')
    setJobs([])
    setJobId(0)
    setCandidates([])
    setShortlistedCandidates([])
    setAnalytics(null)
    setSettings(null)
    setVisibleCandidateIds(null)
    setEditingJobId(null)
    setActiveSection('dashboard')
    setBusy(null)
    setSuccess('')
    setError(message)
  }

async function verifyResponse(
    response: Response,
    fallback: string
  ): Promise<Response> {
    if (response.status === 401) {
      logout(
        'Aapka session expire ho gaya hai. Dobara login karein.'
      )

throw new Error('Session expired')
    }

if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, fallback)
      )
    }

return response
  }

function showRequestError(
    requestError: unknown,
    fallback: string
  ) {
    if (
      requestError instanceof Error &&
      requestError.message !== 'Session expired'
    ) {
      setError(requestError.message || fallback)
    }
  }

async function login() {
    clearMessages()

if (!email.trim() || !password) {
      setError('Email aur password enter karein.')
      return
    }

setBusy('login')

try {
      const response = await fetch(
        `${API}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email.trim(),
            password
          })
        }
      )

if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            'Login failed'
          )
        )
      }

const data = await response.json()

if (!data.access_token) {
        throw new Error(
          'Server ne access token return nahi kiya.'
        )
      }

localStorage.setItem(
        'token',
        data.access_token
      )

setToken(data.access_token)
      setSuccess('Login successful.')
    } catch (loginError) {
      showRequestError(loginError, 'Login failed')
    } finally {
      setBusy(null)
    }
  }

async function loadJobs() {
    if (!token) {
      return
    }

setBusy('jobs')

try {
      const response = await fetch(`${API}/jobs`, {
        headers: authHeaders()
      })

await verifyResponse(
        response,
        'Jobs load nahi ho sake.'
      )

const data: Job[] = await response.json()

setJobs(data)

setJobId(currentJobId => {
        const selectedJobExists = data.some(
          job => job.id === currentJobId
        )

if (selectedJobExists) {
          return currentJobId
        }

return data[0]?.id ?? 0
      })
    } catch (loadError) {
      showRequestError(
        loadError,
        'Jobs load nahi ho sake.'
      )
    } finally {
      setBusy(null)
    }
  }

async function loadCandidates() {
    if (!token || !jobId) {
      setCandidates([])
      return
    }

setBusy('candidates')

try {
      const response = await fetch(
        `${API}/jobs/${jobId}/candidates`,
        {
          headers: authHeaders()
        }
      )

await verifyResponse(
        response,
        'Candidates load nahi ho sake.'
      )

const data: Candidate[] =
        await response.json()

setCandidates(data)
    } catch (loadError) {
      showRequestError(
        loadError,
        'Candidates load nahi ho sake.'
      )
    } finally {
      setBusy(null)
    }
  }

async function loadShortlistedCandidates() {
    if (!token) {
      return
    }

setBusy('shortlisted')

try {
      const response = await fetch(
        `${API}/shortlisted`,
        {
          headers: authHeaders()
        }
      )

await verifyResponse(
        response,
        'Shortlisted candidates load nahi ho sake.'
      )

const data: Candidate[] =
        await response.json()

setShortlistedCandidates(data)
    } catch (loadError) {
      showRequestError(
        loadError,
        'Shortlisted candidates load nahi ho sake.'
      )
    } finally {
      setBusy(null)
    }
  }

async function loadAnalytics() {
    if (!token) {
      return
    }

setBusy('analytics')

try {
      const response = await fetch(
        `${API}/analytics`,
        {
          headers: authHeaders()
        }
      )

await verifyResponse(
        response,
        'Analytics load nahi ho saka.'
      )

const data: Analytics =
        await response.json()

setAnalytics(data)
    } catch (loadError) {
      showRequestError(
        loadError,
        'Analytics load nahi ho saka.'
      )
    } finally {
      setBusy(null)
    }
  }

async function loadSettings() {
    if (!token) {
      return
    }

try {
      const response = await fetch(
        `${API}/settings`,
        {
          headers: authHeaders()
        }
      )

await verifyResponse(
        response,
        'Settings load nahi ho saki.'
      )

const data: Settings =
        await response.json()

setSettings(data)
    } catch (loadError) {
      showRequestError(
        loadError,
        'Settings load nahi ho saki.'
      )
    }
  }

function createJobPayload() {
    return {
      title: title.trim(),
      description: description.trim(),
      min_experience: Number(
        minimumExperience
      ),
      must_skills: mustSkills
        .split(',')
        .map(skill => skill.trim())
        .filter(Boolean),
      good_skills: goodSkills
        .split(',')
        .map(skill => skill.trim())
        .filter(Boolean)
    }
  }

function resetJobForm() {
    setEditingJobId(null)
    setTitle('')
    setDescription('')
    setMinimumExperience('')
    setMustSkills('')
    setGoodSkills('')
  }

function startEditingJob(job: Job) {
    clearMessages()

setEditingJobId(job.id)
    setTitle(job.title)
    setDescription(job.description)
    setMinimumExperience(job.min_experience)
    setMustSkills(job.must_skills.join(', '))
    setGoodSkills(job.good_skills.join(', '))

window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

async function saveJob() {
    clearMessages()

if (!title.trim()) {
      setError('Job title required hai.')
      return
    }

if (
      minimumExperience === '' ||
      Number.isNaN(Number(minimumExperience)) ||
      Number(minimumExperience) < 0
    ) {
      setError(
        'Minimum experience enter karein. Ye zero ya usse zyada honi chahiye.'
      )
      return
    }

setBusy('save-job')

const isEditing = editingJobId !== null

try {
      const url = isEditing
        ? `${API}/jobs/${editingJobId}`
        : `${API}/jobs`

const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(
          createJobPayload()
        )
      })

await verifyResponse(
        response,
        isEditing
          ? 'Job update nahi ho saka.'
          : 'Job create nahi ho saka.'
      )

const savedJob: Job =
        await response.json()

setJobs(currentJobs => {
        if (isEditing) {
          return currentJobs.map(job =>
            job.id === savedJob.id
              ? savedJob
              : job
          )
        }

return [
          savedJob,
          ...currentJobs.filter(
            job => job.id !== savedJob.id
          )
        ]
      })

setJobId(savedJob.id)

setSuccess(
        isEditing
          ? `Job “${savedJob.title}” update ho gaya.`
          : `Job “${savedJob.title}” create ho gaya.`
      )

resetJobForm()
      await loadAnalytics()
    } catch (saveError) {
      showRequestError(
        saveError,
        'Job save nahi ho saka.'
      )
    } finally {
      setBusy(null)
    }
  }

async function deleteJob(job: Job) {
    const confirmed = window.confirm(
      `“${job.title}” delete karein?\n\nIs job ki applications aur sirf isi job se linked resumes bhi delete ho sakte hain.`
    )

if (!confirmed) {
      return
    }

clearMessages()
    setBusy('delete-job')

try {
      const response = await fetch(
        `${API}/jobs/${job.id}`,
        {
          method: 'DELETE',
          headers: authHeaders()
        }
      )

await verifyResponse(
        response,
        'Job delete nahi ho saka.'
      )

const remainingJobs = jobs.filter(
        currentJob => currentJob.id !== job.id
      )

setJobs(remainingJobs)

if (jobId === job.id) {
        setJobId(remainingJobs[0]?.id ?? 0)
        setCandidates([])
        setVisibleCandidateIds(null)
      }

if (editingJobId === job.id) {
        resetJobForm()
      }

setSuccess(
        `Job “${job.title}” delete ho gaya.`
      )

await loadAnalytics()
      await loadShortlistedCandidates()
    } catch (deleteError) {
      showRequestError(
        deleteError,
        'Job delete nahi ho saka.'
      )
    } finally {
      setBusy(null)
    }
  }

async function uploadResumes(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const input = event.target
    const files = input.files

clearMessages()

if (!jobId) {
      setError(
        'Pehle job create ya select karein.'
      )
      input.value = ''
      return
    }

if (!files?.length) {
      return
    }

if (files.length > 200) {
      setError(
        'Ek batch mein maximum 200 resumes allowed hain.'
      )
      input.value = ''
      return
    }

const invalidFiles = Array.from(
      files
    ).filter(file => {
      const lowerName = file.name.toLowerCase()

return !(
        lowerName.endsWith('.pdf') ||
        lowerName.endsWith('.docx')
      )
    })

if (invalidFiles.length > 0) {
      setError(
        'Sirf PDF aur DOCX resume files allowed hain.'
      )
      input.value = ''
      return
    }

const formData = new FormData()

Array.from(files).forEach(file => {
      formData.append('files', file)
    })

setBusy('upload')

try {
      const response = await fetch(
        `${API}/jobs/${jobId}/resumes`,
        {
          method: 'POST',
          headers: authHeaders(false),
          body: formData
        }
      )

await verifyResponse(
        response,
        'Resume upload failed.'
      )

const data: {
        processed: number
        results?: Array<{
          file: string
          candidate?: string
          score?: number
          error?: string
        }>
      } = await response.json()

await loadCandidates()
      await loadAnalytics()

const failedResults =
        data.results?.filter(
          result => Boolean(result.error)
        ) ?? []

if (failedResults.length > 0) {
        const firstErrors = failedResults
          .slice(0, 3)
          .map(
            result =>
              `${result.file}: ${result.error}`
          )
          .join(' | ')

setError(
          `${data.processed} files process hui, lekin ${failedResults.length} files mein error aaya. ${firstErrors}`
        )
      } else {
        setSuccess(
          `${data.processed} resumes successfully process ho gaye.`
        )
      }
    } catch (uploadError) {
      showRequestError(
        uploadError,
        'Resume upload failed.'
      )
    } finally {
      input.value = ''
      setBusy(null)
    }
  }

async function toggleShortlist(
    applicationId: number
  ) {
    clearMessages()
    setBusy('shortlist')

try {
      const response = await fetch(
        `${API}/applications/${applicationId}/shortlist`,
        {
          method: 'PATCH',
          headers: authHeaders()
        }
      )

await verifyResponse(
        response,
        'Shortlist status update nahi ho saka.'
      )

const data: {
        application_id: number
        shortlisted: boolean
      } = await response.json()

let updatedCandidate:
        | Candidate
        | undefined

setCandidates(currentCandidates =>
        currentCandidates.map(candidate => {
          if (
            candidate.application_id ===
            data.application_id
          ) {
            updatedCandidate = {
              ...candidate,
              shortlisted: data.shortlisted
            }

return updatedCandidate
          }

return candidate
        })
      )

if (data.shortlisted) {
        const sourceCandidate =
          updatedCandidate ??
          candidates.find(
            candidate =>
              candidate.application_id ===
              data.application_id
          )

if (sourceCandidate) {
          setShortlistedCandidates(
            currentCandidates => [
              {
                ...sourceCandidate,
                shortlisted: true
              },
              ...currentCandidates.filter(
                candidate =>
                  candidate.application_id !==
                  data.application_id
              )
            ]
          )
        }
      } else {
        setShortlistedCandidates(
          currentCandidates =>
            currentCandidates.filter(
              candidate =>
                candidate.application_id !==
                data.application_id
            )
        )
      }

setSuccess(
        data.shortlisted
          ? 'Candidate shortlist ho gaya.'
          : 'Candidate shortlist se remove ho gaya.'
      )

await loadAnalytics()
    } catch (shortlistError) {
      showRequestError(
        shortlistError,
        'Shortlist status update nahi ho saka.'
      )
    } finally {
      setBusy(null)
    }
  }

async function viewResume(
    candidate: Candidate
  ) {
    clearMessages()
    setBusy('resume')

try {
      const response = await fetch(
        `${API}/candidates/${candidate.candidate_id}/resume`,
        {
          headers: authHeaders(false)
        }
      )

await verifyResponse(
        response,
        'Resume open nahi ho saka.'
      )

const resumeBlob = await response.blob()
      const resumeUrl =
        URL.createObjectURL(resumeBlob)

const openedWindow = window.open(
        resumeUrl,
        '_blank',
        'noopener,noreferrer'
      )

if (!openedWindow) {
        URL.revokeObjectURL(resumeUrl)

throw new Error(
          'Browser ne resume popup block kar diya. Popups allow karke dobara try karein.'
        )
      }

window.setTimeout(() => {
        URL.revokeObjectURL(resumeUrl)
      }, 60000)
    } catch (resumeError) {
      showRequestError(
        resumeError,
        'Resume open nahi ho saka.'
      )
    } finally {
      setBusy(null)
    }
  }

async function applyFilter() {
    clearMessages()

if (!jobId) {
      setError(
        'AI filter lagane se pehle job select karein.'
      )
      return
    }

if (!filterCommand.trim()) {
      setError('Filter command enter karein.')
      return
    }

setBusy('filter')

try {
      const response = await fetch(
        `${API}/jobs/${jobId}/ai-filter`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            command: filterCommand.trim()
          })
        }
      )

await verifyResponse(
        response,
        'AI filter apply nahi ho saka.'
      )

const data: {
        interpreted_filters: {
          minimum_experience:
            | number
            | null
          skills: string[]
          eligible_only: boolean
          shortlisted_only: boolean
          limit: number
        }
        candidate_ids: number[]
      } = await response.json()

setVisibleCandidateIds(
        data.candidate_ids
      )

setSuccess(
        `Filter apply ho gaya. ${data.candidate_ids.length} candidates match hue.`
      )

setActiveSection('resumes')
    } catch (filterError) {
      setVisibleCandidateIds(null)

showRequestError(
        filterError,
        'AI filter apply nahi ho saka.'
      )
    } finally {
      setBusy(null)
    }
  }

function resetFilter() {
    setVisibleCandidateIds(null)
    clearMessages()
    setSuccess(
      'Candidate filter reset ho gaya.'
    )
  }

useEffect(() => {
    const savedToken =
      localStorage.getItem('token')

if (savedToken) {
      setToken(savedToken)
    }
  }, [])

useEffect(() => {
    if (token) {
      void loadJobs()
      void loadAnalytics()
      void loadSettings()
    }
  }, [token])

useEffect(() => {
    const savedTheme =
      localStorage.getItem('theme')

const initialTheme =
      savedTheme === 'dark' ||
      (!savedTheme &&
        window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches)
        ? 'dark'
        : 'light'

setTheme(initialTheme)

document.documentElement.setAttribute(
      'data-theme',
      initialTheme
    )
  }, [])

function toggleTheme() {
    const newTheme =
      theme === 'light' ? 'dark' : 'light'

setTheme(newTheme)
    localStorage.setItem('theme', newTheme)

document.documentElement.setAttribute(
      'data-theme',
      newTheme
    )
  }

useEffect(() => {
    setVisibleCandidateIds(null)

if (token && jobId) {
      void loadCandidates()
    } else {
      setCandidates([])
    }
  }, [token, jobId])

useEffect(() => {
    if (
      token &&
      activeSection === 'shortlisted'
    ) {
      void loadShortlistedCandidates()
    }

if (
      token &&
      activeSection === 'analytics'
    ) {
      void loadAnalytics()
    }

if (
      token &&
      activeSection === 'settings'
    ) {
      void loadSettings()
    }
  }, [token, activeSection])

if (!token) {
    return (
      <div className="login">
        <h1>AI Recruitment MVP</h1>

<p className="muted">
          Demo recruiter login
        </p>

{error && (
          <div
            className="message error-message"
            role="alert"
          >
            {error}
          </div>
        )}

<label htmlFor="login-email">
          Email
        </label>

<input
          id="login-email"
          type="email"
          value={email}
          disabled={busy === 'login'}
          onChange={event =>
            setEmail(event.target.value)
          }
          onKeyDown={event => {
            if (event.key === 'Enter') {
              void login()
            }
          }}
        />

<label htmlFor="login-password">
          Password
        </label>

<input
          id="login-password"
          type="password"
          value={password}
          disabled={busy === 'login'}
          onChange={event =>
            setPassword(event.target.value)
          }
          onKeyDown={event => {
            if (event.key === 'Enter') {
              void login()
            }
          }}
        />

<button
          className="btn"
          type="button"
          disabled={busy === 'login'}
          onClick={() => void login()}
        >
          {busy === 'login'
            ? 'Logging in…'
            : 'Login'}
        </button>
      </div>
    )
  }

const shownCandidates =
    visibleCandidateIds === null
      ? candidates
      : candidates.filter(candidate =>
          visibleCandidateIds.includes(
            candidate.candidate_id
          )
        )

const selectedJob =
    jobs.find(job => job.id === jobId) ??
    null

function renderCandidateList(
    list: Candidate[]
  ) {
    if (
      busy === 'candidates' &&
      list.length === 0
    ) {
      return (
        <p className="muted">
          Candidates load ho rahe hain…
        </p>
      )
    }

if (
      busy === 'shortlisted' &&
      list.length === 0
    ) {
      return (
        <p className="muted">
          Shortlisted candidates load ho
          rahe hain…
        </p>
      )
    }

if (list.length === 0) {
      return (
        <div className="empty-state">
          Is view mein abhi koi candidate
          available nahi hai.
        </div>
      )
    }

return list.map(candidate => (
      <div
        className="candidate"
        key={candidate.application_id}
      >
        <div>
          <div className="candidate-title">
            <b>{candidate.name}</b>

<span
              className={
                candidate.eligible
                  ? 'good'
                  : 'bad'
              }
            >
              {candidate.eligible
                ? 'Eligible'
                : 'Needs review'}
            </span>

{candidate.job_title && (
              <span className="tag">
                {candidate.job_title}
              </span>
            )}
          </div>

<div className="muted">
            {candidate.email ||
              'Email not mentioned'}{' '}
            · {candidate.experience_years}{' '}
            years · {candidate.education}
          </div>

<div className="skills">
            {candidate.skills.length > 0 ? (
              candidate.skills.map(skill => (
                <span
                  className="tag"
                  key={skill}
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="muted">
                Skills not detected
              </span>
            )}
          </div>

<p className="muted">
            {candidate.reasons.join(' • ')}
          </p>
        </div>

<div className="candidate-actions">
          <div className="score">
            {candidate.score}%
          </div>

<button
            className="btn secondary"
            type="button"
            disabled={busy === 'resume'}
            onClick={() =>
              void viewResume(candidate)
            }
          >
            View Resume
          </button>

<button
            className={
              candidate.shortlisted
                ? 'btn secondary'
                : 'btn'
            }
            type="button"
            disabled={busy === 'shortlist'}
            onClick={() =>
              void toggleShortlist(
                candidate.application_id
              )
            }
          >
            {candidate.shortlisted
              ? 'Remove'
              : 'Shortlist'}
          </button>
        </div>
      </div>
    ))
  }

return (
    <div className="shell">
      <aside className="side">
        <h2>Recruit AI</h2>

<nav
          className="navigation"
          aria-label="Main navigation"
        >
          {sections.map(section => (
            <button
              key={section.id}
              type="button"
              className={
                activeSection === section.id
                  ? 'nav-button active'
                  : 'nav-button'
              }
              onClick={() => {
                clearMessages()
                setActiveSection(section.id)
              }}
            >
              {section.label}
            </button>
          ))}
        </nav>

<button
          className="btn secondary theme-button"
          type="button"
          onClick={toggleTheme}
        >
          {theme === 'light'
            ? '🌙 Dark Mode'
            : '☀️ Light Mode'}
        </button>

<button
          className="btn secondary logout-button"
          type="button"
          onClick={() => logout()}
        >
          Logout
        </button>
      </aside>

<main className="main">
        {error && (
          <div
            className="message error-message"
            role="alert"
          >
            {error}
          </div>
        )}

{success && (
          <div
            className="message success-message"
            role="status"
          >
            {success}
          </div>
        )}

{activeSection === 'dashboard' && (
          <>
            <h1>Recruitment Dashboard</h1>

<div className="stat-grid">
              <StatCard
                label="Total Jobs"
                value={
                  analytics?.total_jobs ??
                  jobs.length
                }
              />

<StatCard
                label="Candidates"
                value={
                  analytics?.total_candidates ??
                  0
                }
              />

<StatCard
                label="Eligible"
                value={
                  analytics?.eligible ?? 0
                }
              />

<StatCard
                label="Shortlisted"
                value={
                  analytics?.shortlisted ?? 0
                }
              />
            </div>

<div className="panel">
              <h3>Current Selection</h3>

{selectedJob ? (
                <>
                  <p>
                    <b>{selectedJob.title}</b>
                  </p>

<p className="muted">
                    Minimum experience:{' '}
                    {
                      selectedJob.min_experience
                    }{' '}
                    years
                  </p>

<div className="skills">
                    {selectedJob.must_skills.map(
                      skill => (
                        <span
                          className="tag"
                          key={skill}
                        >
                          {skill}
                        </span>
                      )
                    )}
                  </div>

<br />

<button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setActiveSection('resumes')
                    }
                  >
                    Open Resume Screening
                  </button>
                </>
              ) : (
                <>
                  <p className="muted">
                    Abhi koi job selected nahi
                    hai.
                  </p>

<button
                    className="btn"
                    type="button"
                    onClick={() =>
                      setActiveSection('jobs')
                    }
                  >
                    Create Job
                  </button>
                </>
              )}
            </div>
          </>
        )}

{activeSection === 'jobs' && (
          <>
            <h1>Jobs</h1>

<div className="panel">
              <div className="panel-heading">
                <h3>
                  {editingJobId
                    ? 'Edit Job'
                    : 'Create Job'}
                </h3>

{editingJobId && (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={resetJobForm}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

<div className="grid">
                <input
                  className="field"
                  type="text"
                  value={title}
                  disabled={
                    busy === 'save-job'
                  }
                  onChange={event =>
                    setTitle(event.target.value)
                  }
                  placeholder="Job title likhein, jaise Full-Stack Developer"
                  aria-label="Job title"
                />

<input
                  className="field"
                  type="number"
                  min="0"
                  step="0.5"
                  value={minimumExperience}
                  disabled={
                    busy === 'save-job'
                  }
                  onChange={event =>
                    setMinimumExperience(
                      event.target.value === ''
                        ? ''
                        : Number(
                            event.target.value
                          )
                    )
                  }
                  placeholder="Minimum experience"
                  aria-label="Minimum experience"
                />

<input
                  className="field"
                  type="text"
                  value={mustSkills}
                  disabled={
                    busy === 'save-job'
                  }
                  onChange={event =>
                    setMustSkills(
                      event.target.value
                    )
                  }
                  placeholder="Required skills"
                  aria-label="Must-have skills"
                />

<input
                  className="field"
                  type="text"
                  value={goodSkills}
                  disabled={
                    busy === 'save-job'
                  }
                  onChange={event =>
                    setGoodSkills(
                      event.target.value
                    )
                  }
                  placeholder="Optional skills"
                  aria-label="Good-to-have skills"
                />
              </div>

<textarea
                className="field"
                value={description}
                disabled={busy === 'save-job'}
                onChange={event =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Job responsibilities, complete description"
                aria-label="Job description"
              />

<button
                className="btn"
                type="button"
                disabled={busy === 'save-job'}
                onClick={() => void saveJob()}
              >
                {busy === 'save-job'
                  ? 'Saving…'
                  : editingJobId
                    ? 'Update Job'
                    : 'Create Job'}
              </button>
            </div>

<div className="panel">
              <div className="panel-heading">
                <h3>
                  Existing Jobs ({jobs.length})
                </h3>

<button
                  className="btn secondary"
                  type="button"
                  disabled={busy === 'jobs'}
                  onClick={() =>
                    void loadJobs()
                  }
                >
                  {busy === 'jobs'
                    ? 'Refreshing…'
                    : 'Refresh'}
                </button>
              </div>

{jobs.length === 0 ? (
                <div className="empty-state">
                  Abhi koi job create nahi hui
                  hai.
                </div>
              ) : (
                jobs.map(job => (
                  <div
                    className={
                      job.id === jobId
                        ? 'job-row selected'
                        : 'job-row'
                    }
                    key={job.id}
                  >
                    <button
                      className="job-open"
                      type="button"
                      onClick={() => {
                        setJobId(job.id)
                        setActiveSection(
                          'resumes'
                        )
                      }}
                    >
                      <span>
                        <b>{job.title}</b>

<small>
                          {
                            job.min_experience
                          }{' '}
                          years minimum
                        </small>
                      </span>

<span>Open →</span>
                    </button>

<div className="row-actions">
                      <button
                        className="btn secondary"
                        type="button"
                        onClick={() =>
                          startEditingJob(job)
                        }
                      >
                        Edit
                      </button>

<button
                        className="btn danger"
                        type="button"
                        disabled={
                          busy ===
                          'delete-job'
                        }
                        onClick={() =>
                          void deleteJob(job)
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

{activeSection === 'resumes' && (
          <>
            <h1>Resume Screening</h1>

<div className="panel">
              <h3>
                Select Job and Upload Resumes
              </h3>

<label htmlFor="job-select">
                Job
              </label>

<select
                id="job-select"
                className="field"
                value={jobId}
                disabled={busy === 'upload'}
                onChange={event =>
                  setJobId(
                    Number(event.target.value)
                  )
                }
              >
                <option value={0}>
                  Select job
                </option>

{jobs.map(job => (
                  <option
                    key={job.id}
                    value={job.id}
                  >
                    {job.title}
                  </option>
                ))}
              </select>

<label htmlFor="resume-files">
                Resume files
              </label>

<input
                id="resume-files"
                className="field"
                type="file"
                multiple
                accept=".pdf,.docx"
                disabled={
                  !jobId ||
                  busy === 'upload'
                }
                onChange={uploadResumes}
              />

<p className="muted">
                MVP batch limit: 200 PDF/DOCX
                resumes.
              </p>

{busy === 'upload' && (
                <p className="loading-text">
                  Resumes process ho rahe hain.
                  Please wait…
                </p>
              )}
            </div>

<div className="panel">
              <div className="panel-heading">
                <h3>
                  Ranked Candidates (
                  {shownCandidates.length})
                </h3>

{visibleCandidateIds !==
                  null && (
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={resetFilter}
                  >
                    Reset Filter
                  </button>
                )}
              </div>

{renderCandidateList(
                shownCandidates
              )}
            </div>
          </>
        )}

{activeSection ===
          'shortlisted' && (
          <>
            <h1>Shortlisted</h1>

<div className="panel">
              <div className="panel-heading">
                <h3>
                  All Shortlisted Candidates (
                  {
                    shortlistedCandidates.length
                  }
                  )
                </h3>

<button
                  className="btn secondary"
                  type="button"
                  disabled={
                    busy === 'shortlisted'
                  }
                  onClick={() =>
                    void loadShortlistedCandidates()
                  }
                >
                  {busy === 'shortlisted'
                    ? 'Refreshing…'
                    : 'Refresh'}
                </button>
              </div>

{renderCandidateList(
                shortlistedCandidates
              )}
            </div>
          </>
        )}

{activeSection === 'analytics' && (
          <>
            <h1>Analytics</h1>

<div className="stat-grid">
              <StatCard
                label="Jobs"
                value={
                  analytics?.total_jobs ?? 0
                }
              />

<StatCard
                label="Unique Candidates"
                value={
                  analytics?.total_candidates ??
                  0
                }
              />

<StatCard
                label="Applications"
                value={
                  analytics?.total_applications ??
                  0
                }
              />

<StatCard
                label="Average Score"
                value={`${
                  analytics?.average_score ?? 0
                }%`}
              />
            </div>

<div className="panel">
              <div className="panel-heading">
                <h3>Job Performance</h3>

<button
                  className="btn secondary"
                  type="button"
                  disabled={
                    busy === 'analytics'
                  }
                  onClick={() =>
                    void loadAnalytics()
                  }
                >
                  {busy === 'analytics'
                    ? 'Refreshing…'
                    : 'Refresh'}
                </button>
              </div>

{!analytics?.by_job.length ? (
                <div className="empty-state">
                  Analytics ke liye abhi data
                  available nahi hai.
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Candidates</th>
                        <th>Eligible</th>
                        <th>Shortlisted</th>
                        <th>Average score</th>
                      </tr>
                    </thead>

<tbody>
                      {analytics.by_job.map(
                        item => (
                          <tr key={item.job_id}>
                            <td>{item.title}</td>
                            <td>
                              {item.candidates}
                            </td>
                            <td>
                              {item.eligible}
                            </td>
                            <td>
                              {item.shortlisted}
                            </td>
                            <td>
                              {
                                item.average_score
                              }
                              %
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

{activeSection === 'settings' && (
          <>
            <h1>Settings</h1>

<div className="panel">
              <h3>Account</h3>

<dl className="settings-list">
                <div>
                  <dt>Company</dt>
                  <dd>
                    {settings?.company ?? '—'}
                  </dd>
                </div>

<div>
                  <dt>Email</dt>
                  <dd>
                    {settings?.email ?? email}
                  </dd>
                </div>

<div>
                  <dt>Role</dt>
                  <dd>
                    {settings?.role ?? '—'}
                  </dd>
                </div>
              </dl>

<p className="muted">
                MVP mein account settings
                read-only hain.
              </p>

<button
                className="btn secondary"
                type="button"
                onClick={() => logout()}
              >
                Logout
              </button>
            </div>
          </>
        )}
      </main>

<aside className="ai">
        <h2>AI Recruiter</h2>

<p>
          Hinglish/English command type karein.
        </p>

<textarea
          value={filterCommand}
          disabled={busy === 'filter'}
          onChange={event =>
            setFilterCommand(
              event.target.value
            )
          }
          placeholder="Filter command likhein, jaise Top 10 candidates with 3 years and React"
        />

<div className="ai-actions">
          <button
            className="btn"
            type="button"
            disabled={
              busy === 'filter' || !jobId
            }
            onClick={() => void applyFilter()}
          >
            {busy === 'filter'
              ? 'Applying…'
              : 'Apply Filters'}
          </button>

<button
            className="btn secondary"
            type="button"
            onClick={resetFilter}
          >
            Reset
          </button>
        </div>

<p className="muted">
          Example: “Top 10 eligible candidates
          with 3 years, React and Node.js.”
        </p>

<hr />

<h3>Human approval</h3>

<p className="muted">
          AI sirf recommend karta hai. Final
          shortlist recruiter confirm karta hai.
        </p>
      </aside>
    </div>
  )
}

function StatCard({
  label,
  value
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
