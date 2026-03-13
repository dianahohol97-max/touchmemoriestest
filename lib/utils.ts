import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function formatDate(date: string | Date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
