import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const monobankToken = process.env.MONOBANK_API_TOKEN

async function testMonobank() {
    if (!monobankToken) {
        console.error('Missing MONOBANK_API_TOKEN in .env')
        process.exit(1)
    }

    try {
        const response = await fetch('https://api.monobank.ua/bank/currency', {
            headers: { 'X-Token': monobankToken }
        })

        if (response.ok) {
            console.log('✅ Monobank API connected successfully.')
        } else {
            console.error('❌ Monobank API error:', response.status, response.statusText)
        }
    } catch (err) {
        console.error('❌ Monobank connection failed:', err)
    }
}

testMonobank()
