import type { Origin } from '@/types';

/** 將 Origin 物件格式化為顯示用字串：「國家 產區 莊園」（空白分隔，省略空值） */
export function formatOrigin(o: Origin): string {
  const parts: string[] = [o.country];
  if (o.region) parts.push(o.region);
  if (o.estate) parts.push(o.estate);
  return parts.join(' ');
}

/** 將多個 Origin 用「、」串接 */
export function formatOrigins(origins: Origin[]): string {
  return origins.map(formatOrigin).join('、');
}
