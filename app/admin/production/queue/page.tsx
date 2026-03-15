'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, User, Calendar, FileText } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableQueueItem } from '@/components/admin/production/SortableQueueItem';
import { AssignDesignerDialog } from '@/components/admin/production/AssignDesignerDialog';
import type { ProductionQueueItem } from '@/lib/types/automation';

export default function ProductionQueuePage() {
  const [queueItems, setQueueItems] = useState<ProductionQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ProductionQueueItem | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/production/queue');
      const data = await response.json();
      setQueueItems(data);
    } catch (error) {
      console.error('Error loading production queue:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setQueueItems((items) => {
        const oldIndex = items.findIndex((item) => item.order_id === active.id);
        const newIndex = items.findIndex((item) => item.order_id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Apply manual override to the moved item
        updatePriorityOverride(active.id as string, newIndex);

        return newItems;
      });
    }
  }

  async function updatePriorityOverride(orderId: string, position: number) {
    try {
      await fetch('/api/production/queue/priority', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, position }),
      });
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  }

  async function clearOverride(orderId: string) {
    try {
      await fetch('/api/production/queue/priority', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });
      loadQueue();
    } catch (error) {
      console.error('Error clearing override:', error);
    }
  }

  function handleAssignDesigner(item: ProductionQueueItem) {
    setSelectedOrder(item);
    setIsAssignDialogOpen(true);
  }

  function getStatusBadgeColor(status: string): string {
    const colors: Record<string, string> = {
      confirmed: '#263A99',
      in_production: '#f59e0b',
      quality_check: '#8b5cf6',
      shipped: '#10b981',
    };
    return colors[status] || '#6b7280';
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Виробнича Черга</h1>
          <p className="text-muted-foreground mt-2">
            Перетягуйте замовлення для ручного налаштування пріоритету
          </p>
        </div>
        <Button onClick={loadQueue}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Оновити
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всього в черзі</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueItems.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Експрес</CardTitle>
            <span className="text-xl">⚡</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queueItems.filter((i) => i.has_express_tag).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VIP</CardTitle>
            <span className="text-xl">⭐</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queueItems.filter((i) => i.is_vip_customer).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Непризначені</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queueItems.filter((i) => !i.assigned_designer_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue List with Drag & Drop */}
      <Card>
        <CardHeader>
          <CardTitle>Черга замовлень</CardTitle>
          <p className="text-sm text-muted-foreground">
            Замовлення відсортовані за пріоритетом (найближчий дедлайн зверху)
          </p>
        </CardHeader>
        <CardContent>
          {queueItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Черга порожня</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={queueItems.map((item) => item.order_id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {queueItems.map((item, index) => (
                    <SortableQueueItem
                      key={item.order_id}
                      item={item}
                      index={index}
                      onAssignDesigner={() => handleAssignDesigner(item)}
                      onClearOverride={() => clearOverride(item.order_id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Assign Designer Dialog */}
      {selectedOrder && (
        <AssignDesignerDialog
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          order={selectedOrder}
          onSuccess={() => {
            setIsAssignDialogOpen(false);
            loadQueue();
          }}
        />
      )}
    </div>
  );
}
