/**
 * Human message for eat_pack / complete_plan_entry failures. MI001/MI002 are
 * the custom SQLSTATEs raised by migration 011 when a meal is archived or out
 * of stock; anything else is treated as a connectivity problem.
 */
export function eatErrorMessage(err: unknown, mealName?: string): string {
  const code = (err as { code?: string } | null)?.code
  const name = mealName ?? 'that meal'
  if (code === 'MI002') return `No packs left of ${name}`
  if (code === 'MI001') return `${name} is already archived`
  return 'Could not update — check connection'
}
