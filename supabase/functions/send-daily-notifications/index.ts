// Daily email notification Edge Function
// Sends summary of todos due tomorrow to users who have opted in
// Triggered hourly by pg_cron to handle all timezones

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface TodoSummary {
  due_today: number
  overdue: number
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const now = new Date()

    // Get users with notifications enabled
    const { data: users, error: usersError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, email_notification_time, last_notification_sent_at')
      .eq('email_notifications_enabled', true)

    if (usersError) throw usersError

    // Get user emails from auth
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) throw authError

    const emailMap = new Map(authData.users.map((u: { id: string; email?: string }) => [u.id, u.email]))

    let sent = 0

    for (const user of users || []) {
      // Check if it's the right time in user's timezone
      if (!isNotificationTime(now, user.timezone, user.email_notification_time)) {
        continue
      }

      // Check if already sent today
      if (alreadySentToday(user.last_notification_sent_at, user.timezone)) {
        continue
      }

      const email = emailMap.get(user.user_id)
      if (!email) continue

      // Get todo counts
      const summary = await getTodoSummary(supabase, user.user_id, user.timezone)

      // Skip if nothing to notify about
      if (summary.due_today === 0 && summary.overdue === 0) {
        continue
      }

      // Send email
      await sendEmail(email, summary)

      // Update last sent timestamp
      await supabase
        .from('user_settings')
        .update({ last_notification_sent_at: new Date().toISOString() })
        .eq('user_id', user.user_id)

      sent++
    }

    return new Response(
      JSON.stringify({ success: true, sent }),
      { headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

function isNotificationTime(now: Date, timezone: string, notificationTime: string): boolean {
  try {
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const [targetHour] = notificationTime.split(':').map(Number)
    return userTime.getHours() === targetHour
  } catch {
    return false
  }
}

function alreadySentToday(lastSent: string | null, timezone: string): boolean {
  if (!lastSent) return false

  try {
    const lastSentDate = new Date(lastSent)
    const now = new Date()

    const lastSentLocal = new Date(lastSentDate.toLocaleString('en-US', { timeZone: timezone }))
    const nowLocal = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

    return lastSentLocal.toDateString() === nowLocal.toDateString()
  } catch {
    return false
  }
}

async function getTodoSummary(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string
): Promise<TodoSummary> {
  const now = new Date()
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const today = userNow.toISOString().split('T')[0]

  const { data: todos, error } = await supabase
    .from('todos')
    .select('due_date')
    .eq('user_id', userId)
    .not('due_date', 'is', null)
    .neq('gtd_status', 'done')
    .or('is_template.is.null,is_template.eq.false')

  if (error) throw error

  let due_today = 0
  let overdue = 0

  for (const todo of todos || []) {
    if (todo.due_date === today) {
      due_today++
    } else if (todo.due_date < today) {
      overdue++
    }
  }

  return { due_today, overdue }
}

async function sendEmail(email: string, summary: TodoSummary): Promise<void> {
  const subject = summary.overdue > 0
    ? `${summary.overdue} overdue + ${summary.due_today} due today`
    : `${summary.due_today} todo${summary.due_today > 1 ? 's' : ''} due today`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 30px 20px; }
        h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 20px; }
        .stat { padding: 16px 20px; margin: 12px 0; border-radius: 8px; font-size: 16px; }
        .overdue { background: #fee2e2; border-left: 4px solid #ef4444; color: #991b1b; }
        .today { background: #dbeafe; border-left: 4px solid #3b82f6; color: #1e40af; }
        .number { font-size: 28px; font-weight: bold; display: block; margin-bottom: 4px; }
        .cta { display: inline-block; padding: 14px 28px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; margin-top: 24px; font-weight: 500; }
        .footer { color: #666; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Your Daily Todo Summary</h1>

        ${summary.overdue > 0 ? `
          <div class="stat overdue">
            <span class="number">${summary.overdue}</span>
            overdue todo${summary.overdue > 1 ? 's' : ''}
          </div>
        ` : ''}

        ${summary.due_today > 0 ? `
          <div class="stat today">
            <span class="number">${summary.due_today}</span>
            due today
          </div>
        ` : ''}

        <a href="https://radekcap.github.io/todolist/?view=today" class="cta">
          View Details
        </a>

        <p class="footer">
          You're receiving this because you enabled daily notifications.<br>
          <a href="https://radekcap.github.io/todolist/">Manage settings</a>
        </p>
      </div>
    </body>
    </html>
  `

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'TodoList <onboarding@resend.dev>',
      to: email,
      subject,
      html
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to send email: ${error}`)
  }
}
