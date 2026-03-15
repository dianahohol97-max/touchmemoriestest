'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical,
    User,
    Calendar,
    Clock,
    Printer,
    CheckCircle2,
    AlertCircle,
    UserPlus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProductionQueueItem } from '@/lib/types/automation';

interface SortableQueueItemProps {
    item: ProductionQueueItem;
    index: number;
    onAssignDesigner: () => void;
    onClearOverride: () => void;
}

export function SortableQueueItem({ item, index, onAssignDesigner, onClearOverride }: SortableQueueItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.order_id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 1,
    };

    const isOverdue = new Date(item.production_deadline) < new Date();
    const isUrgent = !isOverdue && new Date(item.production_deadline).getTime() - new Date().getTime() < 24 * 60 * 60 * 1000;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="group bg-white border border-slate-200 rounded-[3px] p-4 mb-2 flex items-center gap-4 hover:border-slate-300 hover:shadow-sm transition-all"
        >
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600">
                <GripVertical size={20} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900">#{item.order_id.substring(0, 8)}</span>
                    <span className="text-sm font-medium text-slate-700">{item.customer_name}</span>
                    {item.has_express_tag && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">⚡ ЕКСПРЕС</Badge>
                    )}
                    {item.is_vip_customer && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] px-1.5 py-0">⭐ VIP</Badge>
                    )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-700">{item.product_title}</span>
                        <span>• {item.page_count} стор.</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Printer Status (New) */}
                <div className="flex flex-col items-center">
                    {(item as any).print_file_url ? (
                        <div title="Файл для друку готовий" className="text-emerald-500 bg-emerald-50 p-2 rounded-full">
                            <Printer size={18} />
                        </div>
                    ) : (
                        <div title="Файл не згенеровано" className="text-slate-300 bg-slate-50 p-2 rounded-full">
                            <Printer size={18} />
                        </div>
                    )}
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-sm" style={{ color: isOverdue ? '#dc2626' : isUrgent ? '#f59e0b' : '#10b981' }}>
                        <Clock size={14} />
                        {new Date(item.production_deadline).toLocaleDateString('uk-UA')}
                    </div>
                    {isOverdue && <span className="text-[10px] uppercase font-black text-red-600 leading-none">ПРОСТРОЧЕНО</span>}
                </div>

                <div className="w-[180px]">
                    {item.assigned_designer_id ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-[3px] border border-slate-100">
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                {item.assigned_designer_name?.[0]}
                            </div>
                            <span className="text-xs font-semibold text-slate-700 truncate">{item.assigned_designer_name}</span>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8 border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50"
                            onClick={onAssignDesigner}
                        >
                            <UserPlus size={14} className="mr-1.5" /> Призначити
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
