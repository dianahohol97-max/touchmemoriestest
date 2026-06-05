/**
 * Checkbox ПРРО Integration Utility
 * Handles authentication, shift management, and fiscal receipt generation.
 * API docs: https://wiki.checkbox.ua/api
 */

const CHECKBOX_API_URL = 'https://api.checkbox.ua/api/v1';
const CLIENT_NAME = 'TouchMemories';
const CLIENT_VERSION = '1.0';

interface CheckboxConfig {
    login: string;
    password?: string;
    licenseKey: string;
    cashierName?: string;
}

export interface CheckboxReceiptResult {
    id: string;
    status?: string;
    fiscalUrl: string;
    raw: any;
}

export class CheckboxService {
    private config: CheckboxConfig;
    private token: string | null = null;

    constructor(config: CheckboxConfig) {
        this.config = config;
    }

    /** Headers Checkbox recommends/requires on every authed call. */
    private authHeaders(json = false): Record<string, string> {
        const h: Record<string, string> = {
            'Authorization': `Bearer ${this.token}`,
            'X-License-Key': this.config.licenseKey,
            'X-Client-Name': CLIENT_NAME,
            'X-Client-Version': CLIENT_VERSION,
        };
        if (json) h['Content-Type'] = 'application/json';
        return h;
    }

    async signIn() {
        const response = await fetch(`${CHECKBOX_API_URL}/cashier/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Client-Name': CLIENT_NAME, 'X-Client-Version': CLIENT_VERSION },
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
        const response = await fetch(`${CHECKBOX_API_URL}/shifts`, { headers: this.authHeaders() });
        const data = await response.json();
        return (data.results || []).find((s: any) => s.status === 'OPENED') || null;
    }

    async openShift() {
        if (!this.token) await this.signIn();
        const activeShift = await this.getActiveShift();
        if (activeShift) return activeShift;

        const response = await fetch(`${CHECKBOX_API_URL}/shifts`, {
            method: 'POST',
            headers: this.authHeaders(true),
            body: JSON.stringify({}),
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
            headers: this.authHeaders(true),
            body: JSON.stringify({}),
        });
        return await response.json();
    }

    /**
     * Create a fiscal receipt for a paid order.
     *
     * receiptType:
     *  - 'sell'       → full online payment (/receipts/sell)
     *  - 'prepayment' → 50% prepaid online (/prepayment-receipts)
     *
     * order.items must have product_name, unit_price (UAH), quantity.
     * The charged amount is order.total (UAH) — that's what we fiscalise.
     */
    async createReceipt(order: any, receiptType: 'sell' | 'prepayment' = 'sell'): Promise<CheckboxReceiptResult> {
        await this.openShift();

        const goods = (order.items || []).map((item: any) => ({
            good: {
                code: String(item.product_id || item.product_type || item.slug || 'PRODUCT'),
                name: (item.product_name || item.name || 'Товар').slice(0, 250),
                price: Math.round((item.unit_price || item.price || 0) * 100), // kopecks
            },
            quantity: Math.round((item.quantity || 1) * 1000), // thousandths
        }));

        // The fiscalised sum is the actual charged amount (already marked-up UAH).
        const value = Math.round((order.total || 0) * 100);

        const payload: any = {
            id: (globalThis.crypto?.randomUUID?.() || `${order.id}-${Date.now()}`),
            // Stable chain key so a later postpayment receipt can close this
            // prepayment (Checkbox links the chain by relation_id).
            relation_id: String(order.order_number || order.id),
            goods,
            payments: [{
                type: 'CASHLESS',
                value,
                label: 'Інтернет-еквайринг', // required non-cash payment signature
            }],
        };
        if (this.config.cashierName) payload.cashier_name = this.config.cashierName;
        if (order.customer_email) payload.delivery = { email: order.customer_email };

        const endpoint = receiptType === 'prepayment'
            ? `${CHECKBOX_API_URL}/prepayment-receipts`
            : `${CHECKBOX_API_URL}/receipts/sell`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: this.authHeaders(true),
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Checkbox Receipt Failed: ${error.message || JSON.stringify(error)}`);
        }
        const data = await response.json();
        return {
            id: data.id,
            status: data.status,
            fiscalUrl: data.id ? `https://check.checkbox.ua/${data.id}` : '',
            raw: data,
        };
    }

    /**
     * Close a 50/50 prepayment chain: register the postpayment (the remainder
     * collected at Nova Poshta on delivery). Same relation_id as the prepayment
     * receipt; Checkbox settles the chain (left_to_pay → 0). The remainder is a
     * cash-on-delivery (накладений платіж), so payment type CASH / "Післяплата".
     * delivery.email makes Checkbox send the receipt to the customer.
     *
     * NOTE: validate against Checkbox TEST mode before relying on it — the
     * prepayment-chain payload has nuances that must be confirmed live.
     */
    async createPostpaymentReceipt(order: any, remainderUah: number): Promise<CheckboxReceiptResult> {
        await this.openShift();

        const goods = (order.items || []).map((item: any) => ({
            good: {
                code: String(item.product_id || item.product_type || item.slug || 'PRODUCT'),
                name: (item.product_name || item.name || 'Товар').slice(0, 250),
                price: Math.round((item.unit_price || item.price || 0) * 100),
            },
            quantity: Math.round((item.quantity || 1) * 1000),
        }));

        const payload: any = {
            id: (globalThis.crypto?.randomUUID?.() || `${order.id}-post-${Date.now()}`),
            relation_id: String(order.order_number || order.id),
            goods,
            payments: [{
                type: 'CASH',
                value: Math.round(remainderUah * 100),
                label: 'Післяплата',
            }],
        };
        if (this.config.cashierName) payload.cashier_name = this.config.cashierName;
        if (order.customer_email) payload.delivery = { email: order.customer_email };

        const response = await fetch(`${CHECKBOX_API_URL}/prepayment-receipts`, {
            method: 'POST',
            headers: this.authHeaders(true),
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Checkbox Postpayment Failed: ${error.message || JSON.stringify(error)}`);
        }
        const data = await response.json();
        return {
            id: data.id,
            status: data.status,
            fiscalUrl: data.id ? `https://check.checkbox.ua/${data.id}` : '',
            raw: data,
        };
    }
}
