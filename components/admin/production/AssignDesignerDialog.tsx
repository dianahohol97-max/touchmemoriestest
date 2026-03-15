'use client';
import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

interface AssignDesignerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: any;
    onSuccess: () => void;
}

export function AssignDesignerDialog({ open, onOpenChange, order, onSuccess }: AssignDesignerDialogProps) {
    const [designers, setDesigners] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            fetchDesigners();
        }
    }, [open]);

    async function fetchDesigners() {
        setLoading(true);
        try {
            const res = await fetch('/api/automation/assign-designer');
            const data = await res.json();
            setDesigners(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    async function handleAssign(designerId: string) {
        setSubmitting(true);
        try {
            const res = await fetch('/api/automation/assign-designer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: order.order_id, designer_id: designerId })
            });
            if (res.ok) {
                toast.success('Дизайнера призначено');
                onSuccess();
            }
        } catch (error) {
            toast.error('Невдалося призначити дизайнера');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Призначити дизайнера</DialogTitle>
                    <DialogDescription>
                        Оберіть дизайнера для замовлення #{order?.order_id.substring(0, 8)}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-2">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : designers.map(designer => (
                        <div
                            key={designer.designer_id}
                            className="flex items-center justify-between p-3 border rounded-[3px] hover:bg-slate-50 cursor-pointer"
                            onClick={() => handleAssign(designer.designer_id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <User size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-900">{designer.designer_name}</div>
                                    <div className="text-[11px] text-slate-500">
                                        {designer.active_orders_count} замовлень • {designer.total_pages_in_queue} стор.
                                    </div>
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" disabled={submitting}>Вибрати</Button>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
