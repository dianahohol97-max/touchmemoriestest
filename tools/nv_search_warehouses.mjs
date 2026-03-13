import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const novaposhtaKey = process.env.NOVA_POSHTA_API_KEY

async function searchWarehouses(cityName) {
    if (!novaposhtaKey || novaposhtaKey === 'ваш_ключ') {
        console.error('❌ Missing or placeholder NOVA_POSHTA_API_KEY')
        return
    }

    try {
        const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: novaposhtaKey,
                modelName: 'Address',
                calledMethod: 'getWarehouses',
                methodProperties: { CityName: cityName }
            })
        })

        const result = await response.json()
        if (result.success) {
            console.log(`✅ Found ${result.data.length} warehouses in ${cityName}`)
            // Log first 3 for verification
            console.log(JSON.stringify(result.data.slice(0, 3), null, 2))
        } else {
            console.error('❌ Nova Poshta API error:', result.errors)
        }
    } catch (err) {
        console.error('❌ Warehouse search failed:', err)
    }
}

// Example usage: node tools/nv_search_warehouses.mjs "Київ"
const city = process.argv[2] || 'Київ'
searchWarehouses(city)
