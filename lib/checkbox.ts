/**
 * Checkbox ПРРО Integration Utility
 * Handles authentication, shift management, and fiscal receipt generation.
 * API docs: https://docs.checkbox.ua
 */

const CHECKBOX_API_URL = 'https://api.checkbox.ua/api/v1';

interface CheckboxConfig {
    login: string;
    password?: string;
    licenseKey: string;
}

export class CheckboxService {
    private config: CheckboxConfig;
    private token: string | null = null;

    constructor(config: CheckboxConfig) {
        this.config = config;
    }

    async signIn() {
        const response = await fetch(`${CHECKBOX_API_URL}/cashier/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: this.config.login, password: this.config.password })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Checkbox SignIn Failed: ${error.message || response.statusText}`);
        }
        const data = await response.json();
        this.token = data.access_token;
        return this.token;
    }

    async getActiveShift() {
        if (!this.token) await this.signIn();
        const response = await fetch(`${CHECKBOX_API_URL}/shifts`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'X-License-Key': this.config.licenseKey
            }
        });
        const data = await response.json();
        return (data.results || []).find((s: any) => s.status === 'OPENED') || null;
    }

    async openShift() {
        const activeShift = await this.getActiveShift();
        if (activeShift) return activeShift;

        const response = await fetch(`${CHECKBOX_API_URL}/shifts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'X-License-Key': this.config.licenseKey
            }
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Failed to open Checkbox shift: ${error.message || response.statusText}`);
        }
        return await response.json();
    }

    async closeShift() {
        if (!this.token) await this.signIn();
        const activeShift = await this.getActiveShift();
        if (!activeShift) return null;

        const response = await fetch(`${CHECKBOX_API_URL}/shifts/close`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'X-License-Key': this.config.licenseKey
            }
        });
        return await response.json();
    }

    /**
     * Create a sell receipt.
     * Expects order with fields: items[], total, customer_email, customer_name
     * order.items must have: product_name, unit_price, quantity
     */
    async createReceipt(order: any, receiptType: 'sell' | 'prepayment' | 'return' = 'sell') {
        await this.openShift();

        // Map order items to Checkbox goods format
        const goods = (order.items || []).map((item: any) => ({
            good: {
                // code must be a string identifier
                code: String(item.product_id || item.product_type || 'PRODUCT'),
                name: item.product_name || item.name || 'Товар',
                // price in kopecks (hundredths of UAH)
                price: Math.round((item.unit_price || item.price || 0) * 100),
            },
            // quantity in thousandths (1 unit = 1000)
            quantity: Math.round((item.quantity || 1) * 1000),
        }));

        const payload: any = {
            goods,
            payments: [{
                type: 'CASHLESS',
                value: Math.round((order.total || 0) * 100)
            }],
        };

        // Send email receipt to customer if email available
        const email = order.customer_email;
        if (email) {
            payload.delivery = { emails: [email] };
        }

        const endpoint = receiptType === 'return'
            ? `${CHECKBOX_API_URL}/receipts/return`
            : receiptType === 'prepayment'
            ? `${CHECKBOX_API_URL}/receipts/prepayment`
            : `${CHECKBOX_API_URL}/receipts/sell`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'X-License-Key': this.config.licenseKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Checkbox Receipt Failed: ${error.message || JSON.stringify(error)}`);
        }

        return await response.json();
    }
}
