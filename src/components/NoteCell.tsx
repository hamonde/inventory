import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export interface NoteRecordInfo {
  date: string;              // 'YYYY-MM-DD'
  typeLabel: string;         // 進庫/出庫/售出/上架/回倉/盤點
  qtyText: string;           // '+5 包' / '-3 包' / '5 包' / '—'
  warehouse: string;         // '展示櫃' / '二樓倉庫 → 展示櫃' / '—'
  beanName: string;          // 含「（已刪除）」字尾
  roastDate: string | null;
  operator: string;
}

interface NoteCellProps {
  note?: string | null;
  info: NoteRecordInfo;
  /** 列表預覽最大寬，預設 200px */
  maxWidthPx?: number;
}

/* 共用元件：列表單行截斷顯示備註，點擊跳出完整內容彈窗 */
export default function NoteCell({ note, info, maxWidthPx = 200 }: NoteCellProps) {
  const [open, setOpen] = useState(false);
  const empty = !note || !note.trim();

  if (empty) {
    return <span className="text-cafe-muted">—</span>;
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 hover:opacity-80 text-left align-middle"
        style={{
          color: '#AC6342',
          textDecoration: 'underline',
          cursor: 'pointer',
          maxWidth: maxWidthPx,
        }}
        title="點擊看完整備註"
      >
        <span
          className="truncate"
          style={{ maxWidth: maxWidthPx - 18 }}
        >
          {note}
        </span>
        <Search className="h-3.5 w-3.5 shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>紀錄詳細</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 text-sm">
            {/* 備註 */}
            <div>
              <div className="text-xs font-medium text-cafe-muted mb-1.5">備註</div>
              <div className="h-px mb-2" style={{ background: '#D6C9B8' }} />
              <div
                className="whitespace-pre-wrap text-cafe-dark"
                style={{ lineHeight: 1.7 }}
              >
                {note}
              </div>
            </div>

            {/* 紀錄資訊 */}
            <div>
              <div className="text-xs font-medium text-cafe-muted mb-1.5">紀錄資訊</div>
              <div className="h-px mb-2" style={{ background: '#D6C9B8' }} />
              <div className="flex flex-col gap-1.5">
                <Row label="日期" value={info.date.replace(/-/g, '/')} />
                <Row label="類型" value={`${info.typeLabel} ${info.qtyText}`.trim()} />
                <Row label="倉庫" value={info.warehouse} />
                <Row label="豆名" value={info.beanName} />
                <Row label="烘豆日期" value={info.roastDate ? info.roastDate.replace(/-/g, '/') : '—'} />
                <Row label="操作員工" value={info.operator} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <div className="w-20 shrink-0 text-cafe-muted">{label}：</div>
      <div className="flex-1 text-cafe-dark break-words">{value}</div>
    </div>
  );
}
