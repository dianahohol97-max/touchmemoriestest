/**
 * Checkbox ПРРО Integration Utility
 * Handles authentication, shift management, and fiscal receipt generation.
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

    /**
     * SignIn to get bearer token
     */
    async signIn() {
        const response = await fetch(`${CHECKBOX_API_URL}/cashier/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                login: this.config.login,
                password: this.config.password
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Checkbox SignIn Failed: ${error.message || response.statusText}`);
        }

        const data = await response.json();
        this.token = data.access_token;
        return this.token;
    }

    /**
     * Check if shift is OPENED
     */
    async getActiveShift() {
        if (!this.token) await this.signIn();

        const response = await fetch(`${CHECKBOX_API_URL}/shifts`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'X-License-Key': this.config.licenseKey
            }
        });

        const data = await response.json();
        return data.results.find((s: any) => s.status === 'OPENED');
    }

    /**
     * Open a new shift if none is active
     */
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
            const error = await response.json();
            throw new Error(`Failed to open Checkbox shift: ${error.message}`);
        }

        return await response.json();
    }

    /**
     * Close a shift
     */
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
     * Create a sell receipt
     */
    async createReceipt(order: any) {
        await this.openShift();

        const payload = {
            goods: order.items.map((item: any) => ({
                good: {
                    code: item.product_id,
                    name: item.name,
                    price: Math.round(item.price * 100) // in kopecks
                },
                quantity: item.quantity * 1000 // in grams/units
            })),
            payments: [{
                type: 'CASHLESS',
                value: Math.round(order.total * 100)
            }],
            delivery: {
                emails: [order.customer_email]
            }
        };

        const response = await fetch(`${CHECKBOX_API_URL}/receipts/sell`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                'X-License-Key': this.config.licenseKey
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Checkbox Receipt Failed: ${error.message}`);
        }

        return await response.json();
    }
}
