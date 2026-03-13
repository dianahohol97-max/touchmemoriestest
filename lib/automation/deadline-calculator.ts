import type { DeadlineCalculationParams } from '@/lib/types/automation';

/**
 * Calculate production deadline based on business rules
 * - Standard: 5 working days
 * - Express tag: 2 working days
 * - Large volume (>60 pages): +1 day
 * - Queue overloaded (>20 active orders): +1 day
 */
export function calculateProductionDeadline(params: DeadlineCalculationParams): Date {
  const { paid_at, page_count, has_express_tag, active_orders_count } = params;

  // Base production days
  let productionDays = has_express_tag ? 2 : 5;

  // Add extra day for large volume
  if (page_count > 60) {
    productionDays += 1;
  }

  // Add extra day if queue is busy
  if (active_orders_count > 20) {
    productionDays += 1;
  }

  return addWorkingDays(paid_at, productionDays);
}

/**
 * Add working days (excluding weekends and holidays)
 * For now, only excludes weekends (Saturday, Sunday)
 */
export function addWorkingDays(startDate: Date, workingDays: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < workingDays) {
    result.setDate(result.getDate() + 1);

    // Skip weekends (0 = Sunday, 6 = Saturday)
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Calculate working days between two dates
 */
export function getWorkingDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Check if deadline is approaching (within 2 working days)
 */
export function isDeadlineApproaching(deadline: Date): boolean {
  const today = new Date();
  const daysUntil = getWorkingDaysBetween(today, deadline);
  return daysUntil <= 2 && daysUntil >= 0;
}

/**
 * Check if deadline has passed
 */
export function isDeadlineOverdue(deadline: Date): boolean {
  const today = new Date();
  return deadline < today;
}

/**
 * Format deadline for display
 */
export function formatDeadline(deadline: Date): string {
  return deadline.toLocaleDateString('uk-UA', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get deadline status with color coding
 */
export function getDeadlineStatus(deadline: Date): {
  label: string;
  color: string;
  daysRemaining: number;
} {
  const today = new Date();
  const daysRemaining = getWorkingDaysBetween(today, deadline);

  if (daysRemaining < 0) {
    return {
      label: 'Прострочено',
      color: '#ef4444', // red
      daysRemaining,
    };
  } else if (daysRemaining === 0) {
    return {
      label: 'Сьогодні',
      color: '#f59e0b', // amber
      daysRemaining,
    };
  } else if (daysRemaining <= 2) {
    return {
      label: `${daysRemaining} дн.`,
      color: '#f59e0b', // amber
      daysRemaining,
    };
  } else {
    return {
      label: `${daysRemaining} дн.`,
      color: '#10b981', // green
      daysRemaining,
    };
  }
}
