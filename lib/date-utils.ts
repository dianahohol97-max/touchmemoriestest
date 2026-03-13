import { addDays, isWeekend, format, differenceInDays } from 'date-fns';
import { uk } from 'date-fns/locale';

/**
 * Calculates a deadline by adding a specific number of working days to a start date.
 */
export function addWorkingDays(startDate: Date | string, workingDaysToAdd: number): Date {
    let date = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < workingDaysToAdd) {
        date = addDays(date, 1);
        if (!isWeekend(date)) {
            daysAdded++;
        }
    }
    return date;
}

/**
 * Gets the urgency status of a deadline relative to today.
 * @returns 'green' (> 2 days), 'yellow' (1-2 days), 'red' (overdue or today)
 */
export function getDeadlineStatus(deadline: Date): 'green' | 'yellow' | 'red' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);

    const diff = differenceInDays(deadlineDate, today);

    if (diff < 0) return 'red';
    if (diff <= 2) return 'yellow';
    return 'green';
}

/**
 * Formats a date to Ukrainian locale string.
 */
export function formatUKDate(date: Date | string): string {
    return format(new Date(date), 'dd MMM yyyy', { locale: uk });
}
