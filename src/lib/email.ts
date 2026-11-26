import type { ISODate, Item } from './types'
import { emailSubject } from './recurrence'

/** Link mailto con Para, CC y asunto cargados. En Android abre Gmail u otra app de correo. */
export function mailtoLink(item: Item, date: ISODate): string {
  const params: string[] = []
  if (item.cc.length) params.push(`cc=${encodeURIComponent(item.cc.join(','))}`)
  params.push(`subject=${encodeURIComponent(emailSubject(item, date))}`)
  return `mailto:${item.to.map(encodeURIComponent).join(',')}?${params.join('&')}`
}

export function parseEmails(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
