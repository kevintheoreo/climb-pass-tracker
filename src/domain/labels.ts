import type { PassType } from './types'

export const PASS_TYPE_LABELS: Record<PassType, string> = {
  multipass: 'Multipass',
  class_pack: 'Class / course pack',
  membership: 'Membership',
  single_entry: 'Single entry',
}

export const BILLING_PERIOD_LABELS = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom period',
} as const

export type BillingPeriod = keyof typeof BILLING_PERIOD_LABELS
