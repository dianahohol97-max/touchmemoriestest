'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AuthModal } from '@/components/ui/AuthModal';

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthModalContextType {
    /**
     * Call this before any action that requires auth.
     * If the user is already logged in → calls `callback` immediately.
     * If not logged in → shows the auth modal; `callback` is called after successful login.
     */
    requireAuth: (callback: () => void, message?: string) => void;
    isLoggedIn: boolean;
}

const AuthModalContext = createContext<AuthModalContextType>({
    requireAuth: (cb) => cb(),
    isLoggedIn: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthModalProvider({ children }: { children: ReactNode }) {
    const supabase = createClient();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState<string | undefined>();
    const pendingCallback = useRef<(() => void) | null>(null);

    // Track auth state
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsLoggedIn(!!session);

            // Handle post-OAuth redirect (Google sign-in)
            if (session && sessionStorage.getItem('authModalPendingCallback')) {
                sessionStorage.removeItem('authModalPendingCallback');
                // The callback was stored before redirect; we can't recover it after page reload,
                // but we close the modal and let the user continue (they're now logged in)
                setIsOpen(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsLoggedIn(!!session);
            if (session && isOpen) {
                // User just logged in while modal was open → fire callback
                if (pendingCallback.current) {
                    pendingCallback.current();
                    pendingCallback.current = null;
                }
                setIsOpen(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [isOpen]);

    const requireAuth = useCallback((callback: () => void, msg?: string) => {
        // Check session synchronously first
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                callback();
            } else {
                pendingCallback.current = callback;
                setMessage(msg);
                setIsOpen(true);
            }
        });
    }, []);

    const handleSuccess = () => {
        if (pendingCallback.current) {
            pendingCallback.current();
            pendingCallback.current = null;
        }
        setIsOpen(false);
    };

    return (
        <AuthModalContext.Provider value={{ requireAuth, isLoggedIn }}>
            {children}
            <AuthModal
                isOpen={isOpen}
                onClose={() => { setIsOpen(false); pendingCallback.current = null; }}
                onSuccess={handleSuccess}
                message={message}
            />
        </AuthModalContext.Provider>
    );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthModal() {
    return useContext(AuthModalContext);
}
