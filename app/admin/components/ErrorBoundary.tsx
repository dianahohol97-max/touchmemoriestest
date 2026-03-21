'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '80vh',
                    flexDirection: 'column',
                    gap: '16px',
                    padding: '40px'
                }}>
                    <AlertTriangle size={48} color="#ef4444" />
                    <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b', marginBottom: '8px' }}>
                        Щось пішло не так
                    </h2>
                    <p style={{ fontSize: '16px', color: '#64748b', textAlign: 'center', maxWidth: '500px' }}>
                        Виникла помилка при завантаженні сторінки. Спробуйте оновити сторінку.
                    </p>
                    {this.state.error && (
                        <details style={{ marginTop: '20px', maxWidth: '600px' }}>
                            <summary style={{ cursor: 'pointer', color: '#6366f1', fontWeight: 700 }}>
                                Деталі помилки
                            </summary>
                            <pre style={{
                                marginTop: '12px',
                                padding: '16px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                fontSize: '12px',
                                overflow: 'auto',
                                color: '#ef4444'
                            }}>
                                {this.state.error.message}
                                {'\n\n'}
                                {this.state.error.stack}
                            </pre>
                        </details>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            padding: '12px 24px',
                            backgroundColor: '#263A99',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(38, 58, 153, 0.35)'
                        }}
                    >
                        Оновити сторінку
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
