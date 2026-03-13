import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const novaposhtaKey = process.env.NOVA_POSHTA_API_KEY

async function testNovaPoshta() {
    if (!novaposhtaKey) {
        console.error('Missing NOVA_POSHTA_API_KEY in .env')
        process.exit(1)
    }

    try {
        const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: novaposhtaKey,
                modelName: 'Common',
                calledMethod: 'getTimeIntervals',
                methodProperties: { RecipientCityRef: '8d5a980d-391c-11dd-90d9-001a92567626' }
            })
        })

        const result = await response.json()
        if (result.success) {
            console.log('✅ Nova Poshta API connected successfully.')
        } else {
            console.error('❌ Nova Poshta API error:', result.errors)
        }
    } catch (err) {
        console.error('❌ Nova Poshta connection failed:', err)
    }
}

testNovaPoshta()
