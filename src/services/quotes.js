const CACHE_KEY = 'dailyQuote'

const FALLBACK_QUOTES = [
    { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { quote: 'It is not enough to be busy; so are the ants. The question is: What are we busy about?', author: 'Henry David Thoreau' },
    { quote: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { quote: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
    { quote: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
    { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { quote: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
    { quote: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
    { quote: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
    { quote: 'Well done is better than well said.', author: 'Benjamin Franklin' },
    { quote: 'What we think, we become.', author: 'Buddha' },
    { quote: 'An unexamined life is not worth living.', author: 'Socrates' },
    { quote: 'Life is what happens when you are busy making other plans.', author: 'John Lennon' },
    { quote: 'The mind is everything. What you think you become.', author: 'Buddha' },
    { quote: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama' },
    { quote: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
    { quote: 'The best revenge is massive success.', author: 'Frank Sinatra' },
    { quote: 'Everything you can imagine is real.', author: 'Pablo Picasso' },
    { quote: 'If you want to lift yourself up, lift up someone else.', author: 'Booker T. Washington' },
    { quote: 'The purpose of our lives is to be happy.', author: 'Dalai Lama' },
    { quote: 'You must be the change you wish to see in the world.', author: 'Mahatma Gandhi' },
    { quote: 'Peace comes from within. Do not seek it without.', author: 'Buddha' },
    { quote: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle' },
    { quote: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates' },
    { quote: 'Turn your wounds into wisdom.', author: 'Oprah Winfrey' },
    { quote: 'Yesterday is history, tomorrow is a mystery, today is a gift of God, which is why we call it the present.', author: 'Bill Keane' },
    { quote: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
    { quote: 'Nothing is impossible, the word itself says I\'m possible!', author: 'Audrey Hepburn' },
    { quote: 'The best way to predict the future is to create it.', author: 'Peter Drucker' },
    { quote: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson' },
    { quote: 'Believe you can and you are halfway there.', author: 'Theodore Roosevelt' },
]

/**
 * Get the day of the year (1-366)
 * @returns {number}
 */
function getDayOfYear() {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    const diff = now - start
    const oneDay = 1000 * 60 * 60 * 24
    return Math.floor(diff / oneDay)
}

/**
 * Get a cached quote from sessionStorage if it's still valid for today
 * @returns {{ quote: string, author: string } | null}
 */
function getCachedQuote() {
    try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (!cached) return null
        const parsed = JSON.parse(cached)
        if (parsed.day === getDayOfYear() && parsed.quote && parsed.author) {
            return { quote: parsed.quote, author: parsed.author }
        }
    } catch {
        // Ignore parse errors
    }
    return null
}

/**
 * Cache a quote in sessionStorage
 * @param {{ quote: string, author: string }} quoteData
 */
function cacheQuote(quoteData) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            day: getDayOfYear(),
            quote: quoteData.quote,
            author: quoteData.author,
        }))
    } catch {
        // Ignore storage errors
    }
}

/**
 * Get a fallback quote based on the day of the year
 * @returns {{ quote: string, author: string }}
 */
function getFallbackQuote() {
    const index = getDayOfYear() % FALLBACK_QUOTES.length
    return FALLBACK_QUOTES[index]
}

/**
 * Fetch the daily quote. Uses sessionStorage cache, then tries an external API,
 * falling back to a built-in list of quotes.
 * @returns {Promise<{ quote: string, author: string }>}
 */
export async function getDailyQuote() {
    const cached = getCachedQuote()
    if (cached) return cached

    try {
        // Use day-of-year to pick a consistent quote for the day (API has 1454 quotes)
        const quoteId = (getDayOfYear() % 1454) + 1
        const response = await fetch(`https://dummyjson.com/quotes/${quoteId}`)
        if (!response.ok) throw new Error('API error')
        const data = await response.json()
        const quoteData = { quote: data.quote, author: data.author }
        cacheQuote(quoteData)
        return quoteData
    } catch {
        const fallback = getFallbackQuote()
        cacheQuote(fallback)
        return fallback
    }
}
