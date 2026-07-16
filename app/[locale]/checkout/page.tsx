'use client';
import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import styles from './checkout.module.css';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { useCartStore } from '@/store/cart-store';
import { duplicateDiscountForCart } from '@/lib/payment/duplicate-discount';
import { getAvailablePaymentOptions, computePaymentAmounts } from '@/lib/payment/options';
import { resolvePriceMultiplier, defaultShipRegion, computeIntlShippingUah, DEFAULT_INTL_SHIPPING, type ShipRegion } from '@/lib/payment/pricing-region';
import { formatPrice, type Currency } from '@/lib/i18n/currency';
import { trackBeginCheckout } from '@/components/providers/AnalyticsProvider';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    CreditCard,
    Truck,
    User,
    CheckCircle2,
    Loader2,
    ChevronLeft,
    ShoppingBag,
    ShieldCheck,
    ImageIcon
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createOrderFileRecords, type OrderFileRecord } from '@/lib/export-utils';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n/context';
import Image from 'next/image';

type Step = 'info' | 'shipping' | 'payment' | 'complete';

export default function CheckoutPage() {
    const { items: allItems, removeItems } = useCartStore();
    const router = useRouter();
    const { t, locale } = useTranslation();
    const [currentStep, setCurrentStep] = useState<Step>('info');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Partial checkout: the cart page stores which items to order now. Filter to
    // those; fall back to the whole cart if the selection is missing/stale, so a
    // direct visit or an invalid selection never renders an empty checkout. Read
    // once on mount (not cleared until success) so a mid-flow refresh keeps it.
    const [checkoutSelIds] = useState<string[] | null>(() => {
        if (typeof window === 'undefined') return null;
        try { const raw = sessionStorage.getItem('tmCheckoutItemIds'); return raw ? JSON.parse(raw) : null; } catch { return null; }
    });
    const items = (() => {
        if (!checkoutSelIds || checkoutSelIds.length === 0) return allItems;
        const sel = new Set(checkoutSelIds.map(String));
        const filtered = allItems.filter((i: any) => sel.has(String(i.id)));
        return filtered.length > 0 ? filtered : allItems;
    })();

    const rawTotal = items.reduce((s: number, it: any) => s + it.price * it.qty, 0);
    const dupDiscount = duplicateDiscountForCart(items as any);
    const [promoCode, setPromoCode] = useState('');
    const [promoId, setPromoId] = useState<string | null>(null);
    const [promoInput, setPromoInput] = useState('');
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoLoading, setPromoLoading] = useState(false);
    const [promoError, setPromoError] = useState('');
    // Gift certificate payment
    const [certInput, setCertInput] = useState('');
    const [certCode, setCertCode] = useState('');
    const [certAmount, setCertAmount] = useState(0);
    const [certLoading, setCertLoading] = useState(false);
    const [certError, setCertError] = useState('');
    // Referral bonus redemption (up to 50% of order). bonusBalance loaded from
    // /api/referral/me; bonusToRedeem is what the user chose to spend.
    const [bonusBalance, setBonusBalance] = useState(0);
    const [useBonus, setUseBonus] = useState(false);
    const total = rawTotal - promoDiscount - dupDiscount;

    // ── Display currency + intl markup ──────────────────────────────
    // Default currency follows locale; the switcher lets anyone flip UAH/EUR.
    // Markup uses the locale's DEFAULT destination (real destination is chosen
    // in the region modal); server re-derives it authoritatively at submit.
    const [displayCurrency, setDisplayCurrency] = useState<Currency>(locale === 'uk' ? 'UAH' : 'EUR');
    // Authoritative delivery destination, chosen on the shipping step. Drives the
    // address form, payment account, +20% markup, split availability and currency.
    const [shipRegionChoice, setShipRegionChoice] = useState<ShipRegion>(defaultShipRegion(locale));
    const isIntl = shipRegionChoice === 'INTL';
    const priceMultiplier = resolvePriceMultiplier(locale, shipRegionChoice);
    const markedSubtotal = Math.round(rawTotal * priceMultiplier);

    // EUR rate + intl shipping policy from the server (same source it charges
    // from, so the displayed free-shipping decision matches the actual charge).
    const [intlCfg, setIntlCfg] = useState({
        rate: 0,
        freeThresholdEur: DEFAULT_INTL_SHIPPING.freeThresholdEur,
        flatFeeEur: DEFAULT_INTL_SHIPPING.flatFeeEur,
    });
    useEffect(() => {
        let cancelled = false;
        fetch('/api/exchange-rate')
            .then(r => r.json())
            .then(d => { if (!cancelled && d?.rate) setIntlCfg({ rate: d.rate, freeThresholdEur: d.freeThresholdEur, flatFeeEur: d.flatFeeEur }); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    // Load the user's referral bonus balance (0 for guests / non-logged-in).
    useEffect(() => {
        let cancelled = false;
        fetch('/api/referral/me')
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (!cancelled && d && typeof d.bonusBalance === 'number') setBonusBalance(d.bonusBalance); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const intlShippingUah = (isIntl && intlCfg.rate > 0)
        ? computeIntlShippingUah(markedSubtotal, intlCfg.rate, { freeThresholdEur: intlCfg.freeThresholdEur, flatFeeEur: intlCfg.flatFeeEur })
        : 0;
    const orderTotalBeforeCredits = Math.max(0, markedSubtotal - promoDiscount - dupDiscount + intlShippingUah);
    // Certificate applies first (covers up to the total); any leftover later → bonuses.
    const certApplied = certCode ? Math.min(certAmount, orderTotalBeforeCredits) : 0;
    const markedTotalBeforeBonus = Math.max(0, orderTotalBeforeCredits - certApplied);
    // Bonus can cover up to 50% of the order total, capped by the user's balance.
    const maxBonusRedeem = Math.floor(markedTotalBeforeBonus * 0.5);
    const bonusRedeemed = useBonus ? Math.min(bonusBalance, maxBonusRedeem) : 0;
    const markedTotal = Math.max(0, markedTotalBeforeBonus - bonusRedeemed);
    // Charge currency is always UAH (Monobank); this only formats what's shown.
    const money = (uah: number) => formatPrice(uah, displayCurrency);

    const supabase = createClient();

    const applyPromo = async () => {
        if (!promoInput.trim()) return;
        setPromoLoading(true);
        setPromoError('');
        const code = promoInput.trim().toUpperCase();
        try {
            const res = await fetch('/api/promo/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    cart_total: rawTotal,
                    email: formData.email || undefined,
                    items: items.map((it: any) => ({
                        product_id: it.product_id || it.id,
                        price: it.price,
                        qty: it.qty ?? it.quantity ?? 1,
                    })),
                }),
            });
            const result = await res.json();
            setPromoLoading(false);
            if (!result.valid) {
                setPromoError(result.message || 'Промокод не знайдено або він не активний');
                return;
            }
            const discount = typeof result.discount_amount === 'number'
                ? result.discount_amount
                : 0;
            setPromoDiscount(Math.min(discount, rawTotal));
            setPromoCode(code);
            setPromoId(result.promo_id || null);
        } catch (err) {
            console.error('Promo validation error:', err);
            setPromoLoading(false);
            setPromoError('Помилка перевірки промокоду');
        }
    };

    // Auto-apply a code arriving via a referral link (?ref=CODE) or the promo
    // link (?promo=CODE), or one ReferralCapture stashed in localStorage. This
    // is what makes agency referral LINKS work end-to-end: the agency shares
    // touchmemories.com.ua/?ref=THEIRCODE, and by the time the client reaches
    // checkout the discount is already applied — no manual entry. If the code
    // is a customer referral code (not a promo_code), validation just fails
    // quietly and the friend-referral path handles it separately.
    useEffect(() => {
        if (promoCode || rawTotal <= 0) return;
        let code = '';
        try {
            const params = new URLSearchParams(window.location.search);
            code = (params.get('promo') || params.get('ref') || '').trim().toUpperCase();
            if (!code) code = (localStorage.getItem('tm_ref_code') || '').trim().toUpperCase();
        } catch { /* ignore */ }
        // Partner codes may contain Cyrillic (generated from agency names,
        // e.g. ПОДОTABB) — a latin-only filter here silently dropped them and
        // referral links applied no discount.
        if (!code || !/^[A-Za-z0-9А-ЯІЇЄҐа-яіїєґ]{4,16}$/.test(code)) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/promo/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code,
                        cart_total: rawTotal,
                        email: formData.email || undefined,
                        items: items.map((it: any) => ({
                            product_id: it.product_id || it.id,
                            price: it.price,
                            qty: it.qty ?? it.quantity ?? 1,
                        })),
                    }),
                });
                const result = await res.json();
                if (cancelled || !result.valid) return;
                const discount = typeof result.discount_amount === 'number' ? result.discount_amount : 0;
                setPromoDiscount(Math.min(discount, rawTotal));
                setPromoCode(code);
                setPromoInput(code);
                setPromoId(result.promo_id || null);
            } catch { /* silent — no code applied */ }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rawTotal]);

    const applyCertificate = async () => {
        if (!certInput.trim()) return;
        setCertLoading(true);
        setCertError('');
        const code = certInput.trim().toUpperCase();
        try {
            const res = await fetch('/api/certificates/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const result = await res.json();
            setCertLoading(false);
            if (!result.valid) {
                const reasons: Record<string, string> = {
                    not_found: 'Сертифікат не знайдено',
                    redeemed: 'Сертифікат вже використано',
                    expired: 'Термін дії сертифіката минув',
                    invalid_format: 'Невірний формат коду',
                };
                setCertError(reasons[result.reason] || 'Сертифікат недійсний');
                return;
            }
            setCertAmount(Number(result.amount) || 0);
            setCertCode(code);
        } catch (err) {
            console.error('Certificate validation error:', err);
            setCertLoading(false);
            setCertError('Помилка перевірки сертифіката');
        }
    };

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        telegram: '',
        city: '',
        branch: '',
        country: '',
        postal: '',
        addressLine: '',
        paymentChoice: 'full_online' as 'full_online' | 'split_50_50',
    });

    // Determine available payment options based on current cart contents
    // Authoritative payment_mode per product, looked up from the DB by
    // slug/product_id. Cart items built by the constructors (journals, books,
    // …) don't carry payment_mode, so trusting the cart item alone made every
    // such item count as full_only and hid the 50% split option. The DB is the
    // source of truth (and the server re-validates on submit anyway).
    const [dbModes, setDbModes] = useState<Record<string, string>>({});
    const [catalogImages, setCatalogImages] = useState<Record<string, string>>({});
    useEffect(() => {
        const slugs = Array.from(new Set(items.map((i: any) => i.slug).filter(Boolean)));
        const ids = Array.from(new Set(items.map((i: any) => i.product_id).filter(Boolean)));
        if (slugs.length === 0 && ids.length === 0) return;
        let cancelled = false;
        (async () => {
            try {
                const sb = supabase;
                const ors: string[] = [];
                if (slugs.length) ors.push(`slug.in.(${slugs.join(',')})`);
                if (ids.length) ors.push(`id.in.(${ids.join(',')})`);
                const { data } = await sb.from('products').select('id, slug, payment_mode, images, og_image').or(ors.join(','));
                if (cancelled || !data) return;
                const map: Record<string, string> = {};
                const imgMap: Record<string, string> = {};
                for (const p of data as any[]) {
                    if (p.slug && p.payment_mode) map[p.slug] = p.payment_mode;
                    if (p.id && p.payment_mode) map[p.id] = p.payment_mode;
                    const img = p.og_image || (Array.isArray(p.images) && p.images[0]) || '';
                    if (img) {
                        if (p.slug) imgMap[p.slug] = img;
                        if (p.id) imgMap[p.id] = img;
                    }
                }
                setDbModes(map);
                setCatalogImages(imgMap);
            } catch { /* fall back to cart-item payment_mode */ }
        })();
        return () => { cancelled = true; };
    }, [items]);

    const paymentOptions = getAvailablePaymentOptions(
        items.map((it: any) => ({
            slug: it.slug,
            name: it.name,
            payment_mode: dbModes[it.slug] || dbModes[it.product_id] || it.payment_mode,
        }))
    );

    // Auto-downgrade split → full if cart changes and split is no longer eligible
    useEffect(() => {
        if (!paymentOptions.allowSplit && formData.paymentChoice === 'split_50_50') {
            setFormData(p => ({ ...p, paymentChoice: 'full_online' }));
        }
    }, [paymentOptions.allowSplit, formData.paymentChoice]);

    // Display preview of the split prepayment. Mirrors the server model: items
    // that aren't 'full_or_split' (e.g. фотодрук) are prepaid in full, the rest
    // is halved. UA-only path (split is disabled for international), so the base
    // `total` is an accurate basis for the shown figure.
    const fullOnlyBase = items.reduce((s: number, it: any) => {
        const m = dbModes[it.slug] || dbModes[it.product_id] || it.payment_mode || 'full_only';
        return m === 'full_or_split' ? s : s + (it.price * it.qty);
    }, 0);
    const splitPrepaidPreview = Math.max(0, Math.round(Math.min(fullOnlyBase, total) + Math.max(0, total - fullOnlyBase) / 2));
    const splitRemainderPreview = Math.max(0, total - splitPrepaidPreview);
    const hasMixedFullOnly = fullOnlyBase > 0 && fullOnlyBase < total;

    const checkoutTracked = useRef(false);
    // Set while we are intentionally sending the buyer to the Monobank payment
    // page. clearCart() empties the cart right before that redirect, which would
    // otherwise trip the "empty cart → /catalog" effect below and hijack the
    // navigation (buyer lands on the catalog instead of the payment page — the
    // "оплата не з'явилась" bug). The guard lets the payment redirect win.
    const redirectingToPaymentRef = useRef(false);
    useEffect(() => {
        if (items.length === 0 && currentStep !== 'complete' && !redirectingToPaymentRef.current) {
            router.push('/catalog');
        }
        if (items.length > 0 && !checkoutTracked.current) {
            trackBeginCheckout(items, rawTotal);
            checkoutTracked.current = true;
        }
    }, [items, currentStep, router, rawTotal]);

    // Capture the cart for abandoned-cart recovery once a valid email is typed.
    // Debounced; the server keeps only the latest snapshot per email and the
    // cron reminds them if no order follows.
    useEffect(() => {
        const email = formData.email.trim().toLowerCase();
        if (!/.+@.+\..+/.test(email) || items.length === 0) return;
        const t = setTimeout(() => {
            fetch('/api/cart/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    items: items.map((it: any) => ({ product_id: it.product_id || it.id, name: it.name, qty: it.qty, price: it.price, image: it.image })),
                    total: rawTotal,
                }),
            }).catch(() => {});
        }, 1500);
        return () => clearTimeout(t);
    }, [formData.email, items, rawTotal]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // ---- Nova Poshta address autocomplete (city + warehouse) ----
    const [citySearch, setCitySearch] = useState(formData.city || '');
    const [cities, setCities] = useState<any[]>([]);
    const [cityRef, setCityRef] = useState('');
    const [showCityList, setShowCityList] = useState(false);
    const [isSearchingCities, setIsSearchingCities] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [showWhList, setShowWhList] = useState(false);
    const cityBoxRef = useRef<HTMLDivElement>(null);
    const whBoxRef = useRef<HTMLDivElement>(null);

    // Debounced city search
    useEffect(() => {
        if (citySearch.length < 2 || citySearch === formData.city) { setCities([]); return; }
        const delay = setTimeout(async () => {
            setIsSearchingCities(true);
            try {
                const res = await fetch('/api/novaposhta', {
                    method: 'POST',
                    body: JSON.stringify({ modelName: 'Address', calledMethod: 'getCities', methodProperties: { FindByString: citySearch, Limit: '20' } }),
                });
                const data = await res.json();
                if (data.success) setCities(data.data || []);
            } catch (e) { console.error('NP city search error:', e); }
            setIsSearchingCities(false);
        }, 400);
        return () => clearTimeout(delay);
    }, [citySearch, formData.city]);

    // Warehouses for the chosen city
    useEffect(() => {
        if (!cityRef) { setWarehouses([]); return; }
        (async () => {
            try {
                const res = await fetch('/api/novaposhta', {
                    method: 'POST',
                    body: JSON.stringify({ modelName: 'Address', calledMethod: 'getWarehouses', methodProperties: { CityRef: cityRef } }),
                });
                const data = await res.json();
                if (data.success) setWarehouses(data.data || []);
            } catch (e) { console.error('NP warehouse fetch error:', e); }
        })();
    }, [cityRef]);

    // Close dropdowns on outside click
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node)) setShowCityList(false);
            if (whBoxRef.current && !whBoxRef.current.contains(e.target as Node)) setShowWhList(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const pickCity = (c: any) => {
        const name = c.Description || '';
        setCitySearch(name);
        setCityRef(c.Ref || '');
        setFormData(prev => ({ ...prev, city: name, branch: '' }));
        setShowCityList(false);
    };

    const filteredWarehouses = formData.branch.trim()
        ? warehouses.filter(w => (w.Description || '').toLowerCase().includes(formData.branch.toLowerCase())).slice(0, 30)
        : warehouses.slice(0, 30);

    const nextStep = () => {
        if (currentStep === 'info') {
            if (!formData.name || !formData.phone || !formData.email) {
                toast.error(t('checkout.fill_contacts'));
                return;
            }
            // Validate phone format client-side
            const cleanedPhone = formData.phone.trim().replace(/[\s\-\(\)\+\.]/g, '');
            if (!/^[0-9]{7,15}$/.test(cleanedPhone)) {
                toast.error('Введіть коректний номер телефону (наприклад +380501234567)');
                return;
            }
            setCurrentStep('shipping');
        } else if (currentStep === 'shipping') {
            if (isIntl) {
                if (!formData.country || !formData.city || !formData.addressLine) {
                    toast.error('Заповніть країну, місто та адресу доставки');
                    return;
                }
            } else if (!formData.city || !formData.branch) {
                toast.error(t('checkout.fill_shipping'));
                return;
            }
            setCurrentStep('payment');
        }
    };

    const prevStep = () => {
        if (currentStep === 'shipping') setCurrentStep('info');
        if (currentStep === 'payment') setCurrentStep('shipping');
    };

    // Auto-determine region: non-Ukrainian locale → international
    const getDefaultRegion = (): 'ua' | 'international' => shipRegionChoice === 'INTL' ? 'international' : 'ua';

    /**
     * After the order is created server-side, read export descriptors that each
     * constructor stashed in sessionStorage under `export_{cartItemId}` and turn
     * them into order_files rows linked to the real order_id. Without this step
     * the 300dpi production files (photobook PDFs, posters, star maps, etc.) the
     * customer built are never attached to the order. Mirrors the logic that used
     * to live in the cart page before checkout became the single payment flow.
     *
     * Each value is either a single descriptor {path, fileName, bucket, ...} or an
     * array of them (the book editor uploads every original photo). Both shapes
     * are normalised to a flat list here.
     */
    const linkPendingExports = async (orderId: string, cartItemIds: string[]) => {
        const records: OrderFileRecord[] = [];

        const toRecord = (data: any): OrderFileRecord | null => {
            if (!data || !data.path || !data.fileName || !data.bucket) return null;
            return {
                order_id: orderId,
                file_path: data.path,
                file_name: data.fileName,
                file_type: data.fileType || 'export',
                file_category: data.fileCategory,
                product_type: data.productType,
                bucket_name: data.bucket,
                file_size: data.size,
                mime_type: data.mimeType || 'image/png',
                page_number: data.pageNumber,
            };
        };

        for (const itemId of cartItemIds) {
            const raw = sessionStorage.getItem(`export_${itemId}`);
            if (!raw) continue;
            try {
                const data = JSON.parse(raw);
                const entries = Array.isArray(data) ? data : [data];
                for (const entry of entries) {
                    const r = toRecord(entry);
                    if (r) records.push(r);
                }
                sessionStorage.removeItem(`export_${itemId}`);
            } catch { /* skip malformed entries */ }
        }

        // Collect any items whose constructor export failed (no print files
        // produced). The editor sets export_failed_{itemId} when html2canvas
        // captured nothing OR every upload failed. We surface this on the order
        // so a manager doesn't ship a wishbook/photobook with no design file.
        const failedItemIds = cartItemIds.filter(id => {
            try { return sessionStorage.getItem(`export_failed_${id}`) === '1'; }
            catch { return false; }
        });
        failedItemIds.forEach(id => { try { sessionStorage.removeItem(`export_failed_${id}`); } catch { /* ignore */ } });
        if (failedItemIds.length > 0) {
            try {
                await fetch(`/api/orders/${orderId}/flag-export-failed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ count: failedItemIds.length }),
                });
            } catch (err) {
                console.error('Failed to flag export-failed order:', err);
            }
        }

        if (records.length > 0) {
            try {
                await createOrderFileRecords(records);
            } catch (err) {
                console.error('Failed to link exports to order:', err);
            }
        }

        // Link saved projects to this order. Constructors that save the project
        // BEFORE payment (e.g. wall calendar) store the cart item id in
        // cart_payload.id but have no order_id yet. Stamp order_id onto them so
        // the Monobank webhook can find the design and trigger the print render.
        // Book editors already set order_id themselves, so this is a no-op there.
        try {
            await fetch('/api/projects/link-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, cartItemIds }),
            });
        } catch (err) {
            console.error('Failed to link projects to order:', err);
        }

        // Save full design JSON for each book/magazine/travelbook cart item so
        // Railway can render them at 300 DPI after payment. The editor stores
        // the design in sessionStorage under design_{cartItemId} at addToCart
        // time; we forward it here with the real order UUID.
        for (const itemId of cartItemIds) {
            let designRaw: string | null = null;
            try { designRaw = sessionStorage.getItem(`design_${itemId}`); } catch { /* ignore */ }
            if (!designRaw) continue;
            try {
                const design = JSON.parse(designRaw);
                const cfg = design.config || {};
                const slug = (cfg.productSlug || '').toLowerCase();
                const isRailwayProduct =
                    slug.includes('photobook') || slug.includes('fotoknig') ||
                    slug.includes('travel') || slug.includes('magazine') ||
                    slug.includes('zhurnal') || slug.includes('fotozhurnal') ||
                    slug.includes('journal') || slug.includes('planner');
                if (!isRailwayProduct) continue;

                let productType = 'photobook';
                if (slug.includes('travel')) productType = 'travelbook';
                else if (slug.includes('magazine') || slug.includes('zhurnal') || slug.includes('fotozhurnal')) productType = 'magazine';
                else if (slug.includes('journal')) productType = 'journal';
                else if (slug.includes('planner')) productType = 'planner';

                await fetch('/api/projects/save-design', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderId,
                        cartItemId: itemId,
                        design,
                        productType,
                        productName: cfg.productName || '',
                        format: cfg.selectedSize || '',
                        coverType: cfg.selectedCoverType || '',
                        totalPages: (design.pages?.length || 1) - 1,
                    }),
                });
                sessionStorage.removeItem(`design_${itemId}`);
            } catch (err) {
                console.error('Failed to save design for Railway render:', err);
            }
        }
    };

    const handleSubmitOrder = async (paymentRegion: 'ua' | 'international' = getDefaultRegion()) => {
        setIsSubmitting(true);
        // Capture cart item ids now — clearCart() later wipes the store, but the
        // sessionStorage export_{id} keys must still be resolvable by id.
        const cartItemIds = items.map((it: any) => it.id);
        try {
            const needsDesigner = items.some((item: any) =>
                item.with_designer ||
                item.options?.with_designer ||
                // Wishbook (and any future) designer flow that adds straight to
                // cart marks itself via metadata.designer_flow / the option
                // label, not the with_designer flag. Catch those too, otherwise
                // the order never becomes a designer order and never shows up in
                // the designers' "Вільні" queue.
                item.metadata?.designer_flow ||
                item.options?.['Оформлення'] === 'Макет робить дизайнер'
            );
            const paymentType: 'full' | 'split' = formData.paymentChoice === 'split_50_50' ? 'split' : 'full';

            // 1. Create order via validated server endpoint.
            // Server re-checks payment_type against products.payment_mode and
            // silently downgrades to 'full' if the cart contains any full_only product.
            const submitRes = await fetch('/api/orders/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customer_name: formData.name,
                    customer_phone: formData.phone,
                    customer_email: formData.email,
                    customer_telegram: formData.telegram || undefined,
                    items: items.map((it: any) => ({
                        product_type: it.category_slug || 'product',
                        product_id: it.product_id,
                        product_name: it.name,
                        quantity: it.qty,
                        unit_price: it.price,
                        total_price: it.price * it.qty,
                        slug: it.slug,
                        options: it.options || {},
                        price_breakdown: it.price_breakdown || undefined,
                        // Preserve structured per-item data (e.g. gift-certificate
                        // recipient name / email / message / face amount) so the
                        // payment webhook can auto-issue the certificate.
                        ...(it.metadata ? { metadata: it.metadata } : {}),
                    })),
                    subtotal: rawTotal,
                    delivery_cost: 0,
                    total,
                    bonus_redeemed: bonusRedeemed,
                    promo_id: promoId,
                    promo_code: promoCode || undefined,
                    certificate_code: certCode || undefined,
                    delivery_method: isIntl ? 'international' : 'nova_poshta',
                    delivery_address: isIntl
                        ? { country: formData.country, city: formData.city, postal: formData.postal, address: formData.addressLine }
                        : { city: formData.city, branch: formData.branch },
                    with_designer: needsDesigner,
                    payment_type: paymentType,
                    // Pricing context — server re-derives the +20% intl markup
                    // from (locale × ship_region); subtotal/total above are BASE UAH.
                    ship_region: shipRegionChoice,
                    locale,
                    display_currency: displayCurrency,
                }),
            });
            const submitData = await submitRes.json();
            if (!submitRes.ok || !submitData.order_id) {
                const errCode = submitData?.error || '';
                const friendlyError =
                    errCode === 'customer_phone invalid'
                        ? 'Введіть коректний номер телефону (наприклад +380501234567)'
                        : errCode === 'customer_name required'
                        ? 'Вкажіть ваше ім\'я'
                        : errCode === 'customer_email invalid'
                        ? 'Введіть коректний email'
                        : 'Не вдалося створити замовлення';
                throw new Error(friendlyError);
            }
            const orderId = submitData.order_id;
            // submitData.payment_type is authoritative (may have been downgraded server-side)
            const actualPaymentType = submitData.payment_type as 'full' | 'split';
            const prepaidAmount = Number(submitData.prepaid_amount || 0);

            // Attach the constructor exports (photobook/poster/star-map/etc. files)
            // to the order before we clear the cart in either branch below.
            await linkPendingExports(orderId, cartItemIds);

            // Fire-and-forget: auto-build print-ready imposition sheets for any
            // custom-size prints / magnets in this order. Idempotent and fully
            // non-blocking — it must never delay or break checkout.
            try {
                const hasPrintables = items.some((it: any) => {
                    const s = `${it.slug || ''} ${it.category_slug || ''}`.toLowerCase();
                    return s.includes('print') || s.includes('magnet') || s.includes('polaroid') || s.includes('druk');
                });
                if (hasPrintables) fetch(`/api/orders/${orderId}/print-sheets`, { method: 'POST' }).catch(() => {});
            } catch { /* ignore */ }

            // Fire-and-forget: generate the wishbook cover.jpg fully server-side.
            // A книга побажань has no customer photos — its whole design lives in
            // the order options — so the server can always produce the print file,
            // independent of the browser export. Guarantees a wishbook never ships
            // without a cover. Idempotent + non-blocking.
            try {
                const hasWishbook = items.some((it: any) => {
                    const s = `${it.slug || ''} ${it.category_slug || ''} ${it.name || ''}`.toLowerCase();
                    return s.includes('wish') || s.includes('pobazhan') || s.includes('guest') || s.includes('побажан');
                });
                if (hasWishbook) fetch(`/api/orders/${orderId}/generate-wishbook-cover`, { method: 'POST' }).catch(() => {});
            } catch { /* ignore */ }

            // 2. ALWAYS create Monobank invoice — invoice is 100% if 'full', 50% if 'split'.
            toast.loading(actualPaymentType === 'split'
                ? `Створюємо посилання на передоплату ${prepaidAmount} ₴...`
                : 'Створюємо посилання на оплату...');
            const invoiceRes = await fetch('/api/monobank/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, paymentRegion }),
            });
            const invoiceData = await invoiceRes.json();

            if (!invoiceRes.ok || !invoiceData.pageUrl) {
                // Payment link could NOT be created (Monobank error / 0-amount /
                // token issue). The order was saved server-side, but we must NOT
                // clear the cart or show a "complete" screen — doing so loses the
                // customer's cart AND hides the failure (they think they paid).
                // Keep the cart intact, surface the real error, and stay on this
                // step so they can retry or contact us.
                console.warn('Monobank invoice failed:', invoiceData.error);
                toast.dismiss();
                toast.error(
                    'Замовлення збережено, але не вдалося створити посилання на оплату. Спробуйте ще раз або напишіть нам — ваш кошик не втрачено.'
                );
                return;
            }

            // Mark that we're leaving for the payment page BEFORE clearing the
            // cart, so the "empty cart → /catalog" effect can't hijack the
            // navigation and the buyer actually reaches Monobank.
            redirectingToPaymentRef.current = true;
            // Partial checkout: drop only the items being paid for now; anything
            // the customer left unchecked stays in the cart for a separate order.
            removeItems(cartItemIds);
            try { sessionStorage.removeItem('tmCheckoutItemIds'); } catch { /* ignore */ }
            toast.dismiss();
            window.location.href = invoiceData.pageUrl;

        } catch (error: any) {
            console.error('Checkout error:', error);
            toast.error('Помилка при оформленні: ' + (error?.message || 'спробуйте ще раз'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (currentStep === 'complete') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navigation />
                <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '140px 20px' }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ textAlign: 'center', maxWidth: '500px' }}
                    >
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: "3px",
                            backgroundColor: '#dcfce7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px'
                        }}>
                            <CheckCircle2 size={40} color="#16a34a" />
                        </div>
                        <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '16px' }}>Дякуємо за замовлення!</h1>
                        <p style={{ color: '#666', fontSize: '18px', lineHeight: 1.6, marginBottom: '32px' }}>
                            Ми отримали вашу заявку і скоро зв'яжемося з вами для підтвердження.
                            Ваші спогади у надійних руках!
                        </p>
                        <button
                            onClick={() => router.push('/catalog')}
                            style={{
                                padding: '16px 32px',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: "3px",
                                fontSize: '16px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Повернутися до каталогу
                        </button>
                    </motion.div>
                </main>
                <Footer categories={[]} />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
            <Navigation />

            <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }} className={styles.checkoutGrid}>

                    {/* Left: Form */}
                    <div style={{ backgroundColor: 'white', borderRadius: "3px", padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                        {/* Stepper Header */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
                            <StepIndicator label={t('checkout.contacts')} active={currentStep === 'info'} completed={currentStep !== 'info'} />
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#eee', alignSelf: 'center' }} />
                            <StepIndicator label={t('checkout.shipping')} active={currentStep === 'shipping'} completed={currentStep === 'payment'} />
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#eee', alignSelf: 'center' }} />
                            <StepIndicator label={t('checkout.payment')} active={currentStep === 'payment'} completed={false} />
                        </div>

                        <AnimatePresence mode="wait">
                            {currentStep === 'info' && (
                                <motion.div
                                    key="info"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px' }}>Контактні дані</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <InputField
                                            label="Ваше ім'я"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Прізвище та ім'я"
                                            icon={<User size={18} />}
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                            <InputField
                                                label="Телефон"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleInputChange}
                                                placeholder="+380"
                                            />
                                            <InputField
                                                label="Email"
                                                name="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="example@mail.com"
                                            />
                                        </div>
                                        <div style={{ marginTop: '20px' }}>
                                            <InputField
                                                label="Telegram (необов'язково)"
                                                name="telegram"
                                                value={formData.telegram}
                                                onChange={handleInputChange}
                                                placeholder="@username або номер"
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '40px' }}>
                                        <NextButton onClick={nextStep} />
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 'shipping' && (
                                <motion.div
                                    key="shipping"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px' }}>{t('checkout.shipping')}</h2>
                                    {/* Delivery destination — authoritative ship region */}
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                        {([['UA', '🇺🇦 Україна (Нова Пошта)'], ['INTL', '🌍 За кордон']] as [ShipRegion, string][]).map(([r, label]) => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => setShipRegionChoice(r)}
                                                style={{
                                                    flex: 1,
                                                    padding: '12px 14px',
                                                    borderRadius: '3px',
                                                    border: shipRegionChoice === r ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                                                    background: shipRegionChoice === r ? 'rgba(38,58,153,0.04)' : '#fff',
                                                    fontWeight: 700,
                                                    fontSize: '14px',
                                                    cursor: 'pointer',
                                                    color: shipRegionChoice === r ? 'var(--primary)' : '#475569',
                                                }}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {!isIntl && (<>
                                        {/* City — Nova Poshta autocomplete */}
                                        <div ref={cityBoxRef} style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                                            <label style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Місто</label>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Truck size={18} /></div>
                                                <input
                                                    value={citySearch}
                                                    onChange={e => {
                                                        setCitySearch(e.target.value);
                                                        setShowCityList(true);
                                                        if (cityRef) { setCityRef(''); setFormData(prev => ({ ...prev, city: '', branch: '' })); }
                                                    }}
                                                    onFocus={() => { if (cities.length) setShowCityList(true); }}
                                                    placeholder="Почніть вводити: Київ, Львів…"
                                                    autoComplete="off"
                                                    style={{ width: '100%', padding: '14px 16px', paddingLeft: '44px', borderRadius: '3px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none' }}
                                                />
                                            </div>
                                            {showCityList && (cities.length > 0 || isSearchingCities) && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto', zIndex: 30 }}>
                                                    {isSearchingCities && cities.length === 0 && <div style={{ padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>Шукаємо…</div>}
                                                    {cities.map(c => (
                                                        <button key={c.Ref} type="button" onClick={() => pickCity(c)}
                                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 14, color: '#1e293b' }}>
                                                            {c.Description}{c.AreaDescription ? <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 6 }}>· {c.AreaDescription} обл.</span> : null}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {/* Warehouse / Поштомат — Nova Poshta autocomplete */}
                                        <div ref={whBoxRef} style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                                            <label style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Відділення / Поштомат</label>
                                            <input
                                                value={formData.branch}
                                                onChange={e => { setFormData(prev => ({ ...prev, branch: e.target.value })); setShowWhList(true); }}
                                                onFocus={() => { if (cityRef && warehouses.length) setShowWhList(true); }}
                                                placeholder={cityRef ? 'Почніть вводити номер або адресу відділення' : 'Спочатку оберіть місто'}
                                                disabled={!cityRef}
                                                autoComplete="off"
                                                style={{ width: '100%', padding: '14px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none', background: cityRef ? '#fff' : '#f8fafc', color: cityRef ? '#1e293b' : '#94a3b8' }}
                                            />
                                            {showWhList && cityRef && filteredWarehouses.length > 0 && (
                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', maxHeight: 260, overflowY: 'auto', zIndex: 30 }}>
                                                    {filteredWarehouses.map(w => (
                                                        <button key={w.Ref} type="button"
                                                            onClick={() => { setFormData(prev => ({ ...prev, branch: w.Description })); setShowWhList(false); }}
                                                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13, color: '#1e293b' }}>
                                                            {w.Description}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        </>)}
                                        {isIntl && (<>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Країна</label>
                                                <input
                                                    value={formData.country}
                                                    onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                                                    placeholder="Poland, Germany, Romania…"
                                                    autoComplete="country-name"
                                                    style={{ width: '100%', padding: '14px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <label style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Місто</label>
                                                    <input
                                                        value={formData.city}
                                                        onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                                        placeholder="City"
                                                        autoComplete="address-level2"
                                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none' }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <label style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Індекс</label>
                                                    <input
                                                        value={formData.postal}
                                                        onChange={e => setFormData(prev => ({ ...prev, postal: e.target.value }))}
                                                        placeholder="ZIP"
                                                        autoComplete="postal-code"
                                                        style={{ width: '100%', padding: '14px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none' }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>Адреса (вулиця, будинок, квартира)</label>
                                                <input
                                                    value={formData.addressLine}
                                                    onChange={e => setFormData(prev => ({ ...prev, addressLine: e.target.value }))}
                                                    placeholder="Street, building, apartment"
                                                    autoComplete="street-address"
                                                    style={{ width: '100%', padding: '14px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', fontSize: '15px', outline: 'none' }}
                                                />
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
                                                Міжнародна доставка — повна передоплата онлайн. Вартість доставки — €{intlCfg.flatFeeEur}. Орієнтовний строк — 1–2 тижні.
                                            </div>
                                        </>)}
                                    </div>
                                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                                        <BackButton onClick={prevStep} />
                                        <NextButton onClick={nextStep} />
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 'payment' && (
                                <motion.div
                                    key="payment"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px' }}>Спосіб оплати</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <PaymentOption
                                            id="full_online"
                                            label="Повна оплата онлайн (Monobank)"
                                            active={formData.paymentChoice === 'full_online'}
                                            onClick={() => setFormData(p => ({ ...p, paymentChoice: 'full_online' }))}
                                            icon={<CreditCard size={24} />}
                                        />
                                        {(paymentOptions.allowSplit && !isIntl) ? (
                                            <>
                                            <PaymentOption
                                                id="split_50_50"
                                                label={`${hasMixedFullOnly ? 'Передоплата' : '50% передоплата'} онлайн (${splitPrepaidPreview} ₴), решта ${splitRemainderPreview} ₴ при отриманні`}
                                                active={formData.paymentChoice === 'split_50_50'}
                                                onClick={() => setFormData(p => ({ ...p, paymentChoice: 'split_50_50' }))}
                                                icon={<Truck size={24} />}
                                            />
                                            {hasMixedFullOnly && (
                                                <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280', lineHeight: 1.4 }}>
                                                    Деякі товари в кошику оплачуються повністю наперед, тому онлайн зараз — {splitPrepaidPreview} ₴, а 50% від решти ({splitRemainderPreview} ₴) ви сплатите при отриманні.
                                                </div>
                                            )}
                                            </>
                                        ) : (
                                            <div style={{
                                                padding: '12px 16px',
                                                backgroundColor: '#f9fafb',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '3px',
                                                fontSize: '13px',
                                                color: '#6b7280',
                                            }}>
                                                {isIntl
                                                    ? 'Міжнародні замовлення — лише повна передоплата онлайн'
                                                    : (paymentOptions.splitBlockedReason || 'Опція 50% передоплати недоступна для цього кошика')}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                                        <BackButton onClick={prevStep} />
                                        <button
                                            onClick={() => handleSubmitOrder(shipRegionChoice === 'INTL' ? 'international' : 'ua')}
                                            disabled={isSubmitting}
                                            style={{
                                                padding: '16px 32px',
                                                backgroundColor: 'var(--primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: "3px",
                                                fontSize: '16px',
                                                fontWeight: 800,
                                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                opacity: isSubmitting ? 0.8 : 1,
                                                boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            {isSubmitting ? (
                                                <><Loader2 className="animate-spin" size={20} />
                                                {formData.paymentChoice === 'split_50_50' ? 'Переходимо до передоплати...' : 'Переходимо до оплати...'}</>
                                            ) : (
                                                <><CreditCard size={20} />
                                                {formData.paymentChoice === 'split_50_50'
                                                    ? `Сплатити ${splitPrepaidPreview} ₴`
                                                    : 'Перейти до оплати'}</>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right: Summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: "3px", padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShoppingBag size={20} color="var(--primary)" />
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Ваше замовлення</h3>
                                </div>
                                <div style={{ display: 'inline-flex', border: '1px solid #e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                                    {(['UAH', 'EUR', 'USD'] as Currency[]).map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setDisplayCurrency(c)}
                                            style={{
                                                padding: '5px 12px',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                border: 'none',
                                                cursor: 'pointer',
                                                background: displayCurrency === c ? 'var(--primary)' : 'transparent',
                                                color: displayCurrency === c ? '#fff' : '#6b7280',
                                            }}
                                        >
                                            {c === 'UAH' ? '₴ UAH' : c === 'EUR' ? '€ EUR' : '$ USD'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', maxHeight: '400px', overflowY: 'auto' }}>
                                {items.map(item => (
                                    <div key={item.id} style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: "3px", overflow: 'hidden', flexShrink: 0 }}>
                                            {(() => {
                                                const imgSrc = item.image || catalogImages[item.product_id || ''] || catalogImages[item.slug || ''] || '';
                                                return imgSrc
                                                    ? <Image src={imgSrc} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8' }}><ImageIcon size={20} /></div>;
                                            })()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2, marginBottom: '4px' }}>{item.name}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>
                                                {item.qty} шт. × {money(item.price * priceMultiplier)}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{money(item.price * item.qty * priceMultiplier)}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '24px' }}>
                                {/* Promo code */}
                                <div style={{ marginBottom: 16 }}>
                                    {!promoCode ? (
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>🏷️ Маєте промокод?</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input
                                                    value={promoInput}
                                                    onChange={e => setPromoInput(e.target.value.toUpperCase())}
                                                    onKeyDown={e => e.key === 'Enter' && applyPromo()}
                                                    placeholder="PROMO2024"
                                                    style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                                />
                                                <button type="button" onClick={applyPromo} disabled={promoLoading}
                                                    style={{ padding: '9px 16px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: promoLoading ? 0.7 : 1 }}>
                                                    {promoLoading ? '...' : 'Застосувати'}
                                                </button>
                                            </div>
                                            {promoError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>{promoError}</div>}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                                                ✓ Промокод <b>{promoCode}</b> — знижка {promoDiscount} ₴
                                            </div>
                                            <button type="button" onClick={() => { setPromoCode(''); setPromoDiscount(0); setPromoInput(''); }}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 18, lineHeight: 1 }}>×</button>
                                        </div>
                                    )}
                                </div>

                                {/* Gift certificate */}
                                <div style={{ marginBottom: 16 }}>
                                    {!certCode ? (
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>🎟️ Маєте подарунковий сертифікат?</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input
                                                    value={certInput}
                                                    onChange={e => setCertInput(e.target.value.toUpperCase())}
                                                    onKeyDown={e => e.key === 'Enter' && applyCertificate()}
                                                    placeholder="Код сертифіката"
                                                    style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }}
                                                />
                                                <button type="button" onClick={applyCertificate} disabled={certLoading}
                                                    style={{ padding: '9px 16px', background: '#1e2d7d', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: certLoading ? 0.7 : 1 }}>
                                                    {certLoading ? '...' : 'Застосувати'}
                                                </button>
                                            </div>
                                            {certError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 5 }}>{certError}</div>}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                                                    ✓ Сертифікат <b>{certCode}</b> на {certAmount} ₴
                                                </div>
                                                <button type="button" onClick={() => { setCertCode(''); setCertAmount(0); setCertInput(''); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 18, lineHeight: 1 }}>×</button>
                                            </div>
                                            {certAmount > orderTotalBeforeCredits && (
                                                <div style={{ fontSize: 12, color: '#166534', marginTop: 4 }}>
                                                    Залишок {certAmount - orderTotalBeforeCredits} ₴ буде зараховано на ваш бонусний рахунок
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: '#666' }}>
                                    <span>{t('checkout.delivery_cost')}:</span>
                                    {isIntl
                                        ? <span style={{ fontWeight: 700, color: intlShippingUah === 0 ? '#16a34a' : '#666' }}>
                                            {money(intlShippingUah)}
                                          </span>
                                        : <span>за тарифами перевізника</span>}
                                </div>
                                {dupDiscount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#16a34a', fontWeight: 700 }}>
                                        <span>🎁 Знижка за копії:</span>
                                        <span>-{money(dupDiscount)}</span>
                                    </div>
                                )}
                                {promoDiscount > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#16a34a', fontWeight: 700 }}>
                                        <span>🏷️ Знижка ({promoCode}):</span>
                                        <span>-{money(promoDiscount)}</span>
                                    </div>
                                )}
                                {bonusBalance > 0 && (
                                    <div style={{ marginBottom: 12, padding: '12px 14px', background: '#f5f7ff', border: '1px solid #c7d2fe', borderRadius: 10 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                            <input type="checkbox" checked={useBonus} onChange={e => setUseBonus(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1e2d7d' }}>
                                                Списати бонуси
                                            </span>
                                            <span style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>
                                                Баланс: {bonusBalance} ₴
                                            </span>
                                        </label>
                                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6, paddingLeft: 28 }}>
                                            Можна оплатити до 50% замовлення ({maxBonusRedeem} ₴)
                                        </div>
                                    </div>
                                )}
                                {certApplied > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#16a34a', fontWeight: 700 }}>
                                        <span>🎟️ Сертифікат:</span>
                                        <span>-{money(certApplied)}</span>
                                    </div>
                                )}
                                {bonusRedeemed > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#16a34a', fontWeight: 700 }}>
                                        <span>🎁 Бонуси:</span>
                                        <span>-{money(bonusRedeemed)}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>
                                    <span>Разом:</span>
                                    <span>{money(markedTotal)}</span>
                                </div>
                                {displayCurrency !== 'UAH' && (
                                    <div style={{ marginTop: '10px', fontSize: '11px', color: '#9ca3af', lineHeight: 1.4 }}>
                                        Оплата здійснюється у гривні (₴{markedTotal}). Сума в {displayCurrency} — орієнтовна, точну суму спише банк за курсом на день оплати.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#f0f9ff', borderRadius: "3px", padding: '24px', border: '1px solid #e0f2fe', display: 'flex', gap: '12px' }}>
                            <ShieldCheck size={24} color="#263A99" />
                            <p style={{ fontSize: '13px', color: '#263A99', lineHeight: 1.5, margin: 0 }}>
                                <strong>Безпечна оплата.</strong> Ваші дані захищені. Ми використовуємо сучасні стандарти безпеки.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <Footer categories={[]} />

        </div>
    );
}

// Helper Components
function StepIndicator({ label, active, completed }: { label: string, active: boolean, completed: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: "3px",
                backgroundColor: completed ? '#dcfce7' : (active ? 'var(--primary)' : '#f3f4f6'),
                color: completed ? '#16a34a' : (active ? 'white' : '#9ca3af'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700
            }}>
                {completed ? <CheckCircle2 size={18} /> : (active ? '•' : '')}
            </div>
            <span style={{ fontSize: '11px', fontWeight: active || completed ? 700 : 500, color: active || completed ? '#263A99' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </span>
        </div>
    );
}

function InputField({ label, icon, ...props }: any) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>{label}</label>
            <div style={{ position: 'relative' }}>
                {icon && <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>{icon}</div>}
                <input
                    {...props}
                    style={{
                        width: '100%',
                        padding: `14px 16px ${icon ? '14px 44px' : '14px 16px'}`,
                        paddingLeft: icon ? '44px' : '16px',
                        borderRadius: "3px",
                        border: '1px solid #e2e8f0',
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                />
            </div>
        </div>
    );
}

function NextButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '16px 32px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: "3px",
                fontSize: '16px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
            Далі <ChevronRight size={20} />
        </button>
    );
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '16px 24px',
                backgroundColor: 'transparent',
                color: '#64748b',
                border: 'none',
                borderRadius: "3px",
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}
        >
            <ChevronLeft size={20} /> Назад
        </button>
    );
}

function ArrowRight({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}

function PaymentOption({ id, label, active, onClick, icon }: any) {
    return (
        <div
            onClick={onClick}
            style={{
                padding: '20px',
                borderRadius: "3px",
                border: active ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                backgroundColor: active ? '#f8fafc' : 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s'
            }}
        >
            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: "3px",
                backgroundColor: active ? 'white' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: active ? 'var(--primary)' : '#64748b',
                boxShadow: active ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'
            }}>
                {icon}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#263A99' }}>{label}</div>
            </div>
            <div style={{
                width: '20px',
                height: '20px',
                borderRadius: "3px",
                border: active ? '6px solid var(--primary)' : '2px solid #e2e8f0',
                transition: 'all 0.2s'
            }} />
        </div>
    );
}
