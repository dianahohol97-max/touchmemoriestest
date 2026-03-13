import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Checkbox Fiscalization Tool
 * 
 * Logic based on architecture/payment_fiscalization.md
 */

async function fiscalizeOrder(orderId, customerEmail, items, totalAmount) {
    const login = process.env.CHECKBOX_LOGIN
    const password = process.env.CHECKBOX_PASSWORD
    const licenseKey = process.env.CHECKBOX_LICENSE_KEY

    if (!login || !password || !licenseKey) {
        throw new Error('Missing Checkbox credentials')
    }

    try {
        // 1. Sign In
        const authRes = await fetch('https://api.checkbox.ua/api/v1/signin/me', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-License-Key': licenseKey },
            body: JSON.stringify({ login, password })
        })

        if (!authRes.ok) throw new Error(`Auth failed: ${authRes.statusText}`)
        const { access_token } = await authRes.json()

        // 2. Map Goods
        const goods = items.map(item => ({
            code: item.product_id,
            name: item.name,
            price: Math.round(item.price * 100), // Checkbox expects kopecks
            quantity: item.qty * 1000 // and quantities in 1000s
        }))

        // 3. Create Receipt
        const receiptRes = await fetch('https://api.checkbox.ua/api/v1/receipts/sell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`,
                'X-License-Key': licenseKey
            },
            body: JSON.stringify({
                goods,
                delivery: { email: customerEmail },
                payments: [{ type: 'CASHLESS', value: Math.round(totalAmount * 100) }]
            })
        })

        const receipt = await receiptRes.json()
        if (!receiptRes.ok) {
            console.error('❌ Checkbox Receipt Error:', receipt)
            return { success: false, error: receipt.message }
        }

        console.log(`✅ Fiscal receipt created: ${receipt.id}`)
        return { success: true, receiptId: receipt.id, receiptUrl: `https://checkbox.ua/receipt/${receipt.id}` }

    } catch (err) {
        console.error('❌ Fiscalization failed:', err.message)
        return { success: false, error: err.message }
    }
}

// Support CLI execution for testing
if (process.argv[1].includes('checkbox_fiscalize.mjs')) {
    const [id, email, amount] = process.argv.slice(2)
    fiscalizeOrder(id, email, [{ name: 'Test Product', product_id: 'test', price: amount, qty: 1 }], amount)
}

export { fiscalizeOrder }
