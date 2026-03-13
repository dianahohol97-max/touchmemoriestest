import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const checkboxLogin = process.env.CHECKBOX_LOGIN
const checkboxPassword = process.env.CHECKBOX_PASSWORD

async function testCheckbox() {
    if (!checkboxLogin || !checkboxPassword) {
        console.error('Missing Checkbox credentials in .env')
        process.exit(1)
    }

    try {
        const response = await fetch('https://api.checkbox.ua/api/v1/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: checkboxLogin, password: checkboxPassword })
        })

        if (response.ok) {
            console.log('✅ Checkbox API connected (Authenticated).')
        } else {
            console.error('❌ Checkbox API error:', response.status, response.statusText)
        }
    } catch (err) {
        console.error('❌ Checkbox connection failed:', err)
    }
}

testCheckbox()
