import type { PriorityCalculationParams, ProductionQueueItem } from '@/lib/types/automation';

/**
 * Calculate priority score for an order
 * Lower score = higher priority (appears first in queue)
 *
 * Rules:
 * 1. Closest deadline = highest priority (base score)
 * 2. Express tag = boost priority by 2 positions
 * 3. VIP customer = boost priority by 1 position
 * 4. Manual override = always respected
 */
export function calculatePriorityScore(params: PriorityCalculationParams): number {
  const { production_deadline, has_express_tag, is_vip_customer, manual_override } = params;

  // Manual override takes precedence
  if (manual_override !== undefined) {
    return manual_override;
  }

  // Base score: milliseconds until deadline (lower = higher priority)
  const now = new Date();
  let score = production_deadline.getTime() - now.getTime();

  // Express tag: reduce score by 2 days worth of milliseconds
  if (has_express_tag) {
    score -= 2 * 24 * 60 * 60 * 1000; // 2 days in ms
  }

  // VIP customer: reduce score by 1 day worth of milliseconds
  if (is_vip_customer) {
    score -= 1 * 24 * 60 * 60 * 1000; // 1 day in ms
  }

  return score;
}

/**
 * Sort production queue items by priority
 */
export function sortQueueByPriority(items: ProductionQueueItem[]): ProductionQueueItem[] {
  return [...items].sort((a, b) => {
    // Manual overrides always take precedence
    if (a.manual_priority_override !== undefined && b.manual_priority_override !== undefined) {
      return a.manual_priority_override - b.manual_priority_override;
    }
    if (a.manual_priority_override !== undefined) return -1;
    if (b.manual_priority_override !== undefined) return 1;

    // Otherwise sort by calculated priority score
    return a.priority_score - b.priority_score;
  });
}

/**
 * Recalculate priorities for entire queue
 */
export function recalculateQueuePriorities(items: ProductionQueueItem[]): ProductionQueueItem[] {
  const updated = items.map((item) => {
    const score = calculatePriorityScore({
      production_deadline: new Date(item.production_deadline),
      has_express_tag: item.has_express_tag,
      is_vip_customer: item.is_vip_customer,
      manual_override: item.manual_priority_override,
    });

    return {
      ...item,
      priority_score: score,
    };
  });

  return sortQueueByPriority(updated);
}

/**
 * Get priority badge info for display
 */
export function getPriorityBadge(item: ProductionQueueItem): {
  label: string;
  color: string;
  icon?: string;
} {
  if (item.manual_priority_override !== undefined) {
    return {
      label: 'Ручний пріоритет',
      color: '#8b5cf6', // purple
      icon: '📌',
    };
  }

  const deadline = new Date(item.production_deadline);
  const now = new Date();
  const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) {
    return {
      label: 'Критичний',
      color: '#ef4444', // red
      icon: '🔥',
    };
  } else if (daysUntil <= 1) {
    return {
      label: 'Терміново',
      color: '#f59e0b', // amber
      icon: '⚡',
    };
  } else if (item.has_express_tag) {
    return {
      label: 'Експрес',
      color: '#3b82f6', // blue
      icon: '⚡',
    };
  } else if (item.is_vip_customer) {
    return {
      label: 'VIP',
      color: '#eab308', // yellow
      icon: '⭐',
    };
  } else {
    return {
      label: 'Стандарт',
      color: '#10b981', // green
    };
  }
}

/**
 * Apply manual priority override
 */
export function applyManualOverride(
  items: ProductionQueueItem[],
  orderId: string,
  newPosition: number
): ProductionQueueItem[] {
  const updated = items.map((item, index) => {
    if (item.order_id === orderId) {
      return {
        ...item,
        manual_priority_override: newPosition,
      };
    }
    return item;
  });

  return sortQueueByPriority(updated);
}

/**
 * Clear manual override for an order
 */
export function clearManualOverride(
  items: ProductionQueueItem[],
  orderId: string
): ProductionQueueItem[] {
  const updated = items.map((item) => {
    if (item.order_id === orderId) {
      const { manual_priority_override, ...rest } = item;
      return rest as ProductionQueueItem;
    }
    return item;
  });

  return recalculateQueuePriorities(updated);
}
