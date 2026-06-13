/**
 * Sports API client — api-sports.io (v3)
 * Free tier: 100 req/day at rapidapi.com/api-sports/api/api-football
 * Or subscribe directly at api-sports.io
 *
 * Env: SPORTS_API_KEY
 */

const BASE = 'https://v3.football.api-sports.io'

// ── Types ─────────────────────────────────────────────────────

export interface RawFixture {
  fixture: {
    id: number
    date: string
    status: { short: string; long: string }
  }
  league: { id: number; name: string; country: string; season: number }
  teams: {
    home: { id: number; name: string }
    away: { id: number; name: string }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime:  { home: number | null; away: number | null }
    fulltime:  { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty:   { home: number | null; away: number | null }
  }
}

export interface MatchResult {
  fixtureId:  number
  status:     string
  finished:   boolean
  inProgress: boolean
  homeTeam:   string
  awayTeam:   string
  homeGoals:  number | null
  awayGoals:  number | null
  date:       string
  leagueName: string | null
  similarity: number
}

// ── Constants ─────────────────────────────────────────────────

const FINISHED_STATUSES  = new Set(['FT', 'FT_PEN', 'AET', 'AWD', 'WO'])
const IN_PROGRESS_STATUS = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'])

// ── Helpers ───────────────────────────────────────────────────

export function normalizeTeam(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function teamSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const na = normalizeTeam(a)
  const nb = normalizeTeam(b)
  if (na === nb) return 1.0
  if (na.includes(nb) || nb.includes(na)) return 0.85
  const wa = na.split(' ').filter((w) => w.length > 2)
  const wb = nb.split(' ').filter((w) => w.length > 2)
  const max = Math.max(wa.length, wb.length)
  if (max === 0) return 0
  const shared = wa.filter((w) => wb.includes(w)).length
  return shared / max
}

// ── In-memory cache (one serverless invocation = one job run) ─

const cache = new Map<string, { data: RawFixture[]; ts: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

export async function getFixturesForDate(date: string): Promise<RawFixture[]> {
  const now = Date.now()
  const hit = cache.get(date)
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    console.log(`[sportsApi] cache hit for ${date} (${hit.data.length} fixtures)`)
    return hit.data
  }

  const apiKey = process.env.SPORTS_API_KEY
  if (!apiKey) throw new Error('SPORTS_API_KEY not configured')

  console.log(`[sportsApi] fetching fixtures for ${date}`)
  const res = await fetch(`${BASE}/fixtures?date=${date}`, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
  })

  if (!res.ok) {
    throw new Error(`Sports API error: ${res.status} ${res.statusText}`)
  }

  const json = (await res.json()) as { response?: RawFixture[]; errors?: unknown }
  if (!json.response) {
    throw new Error(`Sports API returned no response: ${JSON.stringify(json.errors)}`)
  }

  cache.set(date, { data: json.response, ts: now })
  console.log(`[sportsApi] ${json.response.length} fixtures found for ${date}`)
  return json.response
}

export function findBestMatch(
  fixtures: RawFixture[],
  homeTeam: string,
  awayTeam: string,
  threshold = 0.45,
): MatchResult | null {
  let best: { f: RawFixture; score: number } | null = null

  for (const f of fixtures) {
    const hs = teamSimilarity(homeTeam, f.teams.home.name)
    const as_ = teamSimilarity(awayTeam, f.teams.away.name)
    const score = (hs * 0.5) + (as_ * 0.5)
    if (score >= threshold && (!best || score > best.score)) {
      best = { f, score }
    }
  }

  if (!best) return null

  const { f, score } = best
  const statusShort = f.fixture.status.short
  const finished    = FINISHED_STATUSES.has(statusShort)
  const inProgress  = IN_PROGRESS_STATUS.has(statusShort)

  const ft = f.score.fulltime
  const homeGoals = finished ? (ft.home ?? f.goals.home) : null
  const awayGoals = finished ? (ft.away ?? f.goals.away) : null

  return {
    fixtureId: f.fixture.id,
    status:     statusShort,
    finished,
    inProgress,
    homeTeam:  f.teams.home.name,
    awayTeam:  f.teams.away.name,
    homeGoals,
    awayGoals,
    date:      f.fixture.date,
    leagueName: f.league.name,
    similarity: Math.round(score * 100) / 100,
  }
}

/**
 * Search for a match across multiple dates (signal date + next day + prev day).
 * Returns the first found result with the highest similarity.
 */
export async function searchMatch(
  homeTeam: string,
  awayTeam: string,
  signalDate: string, // YYYY-MM-DD
): Promise<{ result: MatchResult | null; datesChecked: string[] }> {
  const offsets = [0, 1, -1, 2]
  const datesChecked: string[] = []
  let best: MatchResult | null = null

  for (const offset of offsets) {
    const d = new Date(Date.parse(signalDate) + offset * 86_400_000)
    const date = d.toISOString().slice(0, 10)
    datesChecked.push(date)

    let fixtures: RawFixture[]
    try {
      fixtures = await getFixturesForDate(date)
    } catch {
      continue
    }

    const m = findBestMatch(fixtures, homeTeam, awayTeam)
    if (m && (!best || m.similarity > best.similarity)) {
      best = m
      if (m.similarity >= 0.8) break // good enough, stop early
    }
  }

  return { result: best, datesChecked }
}
