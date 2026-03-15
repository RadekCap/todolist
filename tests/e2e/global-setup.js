/**
 * Playwright global setup — ensures the test account has categories, contexts,
 * and priorities so that E2E tests relying on those dropdowns are not skipped.
 *
 * Runs once before all test files.  Idempotent: checks for existing data
 * before inserting anything.
 */

const SUPABASE_URL = 'https://rkvmujdayjmszmyzbhal.supabase.co'
const SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrdm11amRheWptc3pteXpiaGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODc2MDcsImV4cCI6MjA3OTc2MzYwN30.55RoV1mmHeykVz9waU7Jz6-JSkrRqlNa-ABBE8SN-jA'

async function globalSetup() {
    const email = process.env.TEST_USER_EMAIL
    const password = process.env.TEST_USER_PASSWORD

    if (!email || !password) {
        console.log('[global-setup] TEST_USER_EMAIL / TEST_USER_PASSWORD not set — skipping data seeding')
        return
    }

    // --- Authenticate -----------------------------------------------------------
    const authResp = await fetch(
        `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        }
    )

    if (!authResp.ok) {
        const body = await authResp.text()
        throw new Error(`[global-setup] Auth failed (${authResp.status}): ${body}`)
    }

    const { access_token } = await authResp.json()

    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }

    // --- Helper: fetch existing rows --------------------------------------------
    async function fetchRows(table) {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers })
        if (!resp.ok) {
            const body = await resp.text()
            throw new Error(`[global-setup] Failed to fetch ${table} (${resp.status}): ${body}`)
        }
        return resp.json()
    }

    // --- Helper: insert rows ----------------------------------------------------
    async function insertRows(table, rows) {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(rows)
        })
        if (!resp.ok) {
            const body = await resp.text()
            throw new Error(`[global-setup] Failed to insert into ${table} (${resp.status}): ${body}`)
        }
        const data = await resp.json()
        console.log(`[global-setup] Inserted ${data.length} row(s) into ${table}`)
    }

    // --- Categories -------------------------------------------------------------
    const categories = await fetchRows('categories')
    if (categories.length < 2) {
        const needed = [
            { name: 'Test Category 1', color: '#4a90d9' },
            { name: 'Test Category 2', color: '#e74c3c' }
        ].filter(c => !categories.some(existing => existing.name === c.name))
        if (needed.length > 0) {
            await insertRows('categories', needed)
        } else {
            console.log('[global-setup] Categories already exist — skipping')
        }
    } else {
        console.log(`[global-setup] ${categories.length} categories already exist — skipping`)
    }

    // --- Contexts ---------------------------------------------------------------
    const contexts = await fetchRows('contexts')
    if (contexts.length < 2) {
        const needed = [
            { name: 'Test Context 1' },
            { name: 'Test Context 2' }
        ].filter(c => !contexts.some(existing => existing.name === c.name))
        if (needed.length > 0) {
            await insertRows('contexts', needed)
        } else {
            console.log('[global-setup] Contexts already exist — skipping')
        }
    } else {
        console.log(`[global-setup] ${contexts.length} contexts already exist — skipping`)
    }

    // --- Priorities -------------------------------------------------------------
    const priorities = await fetchRows('priorities')
    if (priorities.length < 2) {
        const needed = [
            { name: 'High', color: '#e74c3c', level: 1 },
            { name: 'Low', color: '#95a5a6', level: 2 }
        ].filter(p => !priorities.some(existing => existing.name === p.name))
        if (needed.length > 0) {
            await insertRows('priorities', needed)
        } else {
            console.log('[global-setup] Priorities already exist — skipping')
        }
    } else {
        console.log(`[global-setup] ${priorities.length} priorities already exist — skipping`)
    }

    console.log('[global-setup] Data seeding complete')
}

export default globalSetup
