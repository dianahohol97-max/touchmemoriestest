'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
    children?: ReactNode;
    fallbackTitle?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Admin Panel Uncaught Error:', error, errorInfo);
    }

    public render() {
        if (// @ts-ignore
        this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3px] text-center">
                    <div className="bg-red-100 p-4 rounded-full mb-4">
                        <AlertCircle className="h-12 w-12 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                        {// @ts-ignore
        this.props.fallbackTitle || 'Сталася помилка завантаження'}
                    </h2>
                    <p className="text-slate-600 mb-6 max-w-md">
                        Виникла непередбачувана помилка при відображенні цього компонента.
                        Будь ласка, спробуйте оновити сторінку або зверніться до розробника.
                    </p>
                    {// @ts-ignore
        this.state.error && (
                        <div className="bg-slate-100 p-4 rounded-[3px] mb-6 text-left overflow-auto max-w-full">
                            <code className="text-xs text-red-700 whitespace-pre-wrap">
                                {// @ts-ignore
        this.state.error.toString()}
                            </code>
                        </div>
                    )}
                    <Button
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Оновити сторінку
                    </Button>
                </div>
            );
        }

        return // @ts-ignore
        this.props.children;
    }
}
