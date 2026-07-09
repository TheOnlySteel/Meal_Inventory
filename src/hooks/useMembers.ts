import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { HouseholdMember } from '../lib/types'
import { useAuth } from './useAuth'
import { useHousehold } from './useHousehold'

const MEMBERS_KEY = ['members']
export const membersKey = (hid: string | null) => [...MEMBERS_KEY, hid]

export function useMembers() {
  const { household } = useHousehold()
  const hid = household?.id ?? null
  return useQuery({
    queryKey: membersKey(hid),
    enabled: !!hid,
    queryFn: async (): Promise<HouseholdMember[]> => {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, user_id, role, display_name, created_at')
        .eq('household_id', hid!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as HouseholdMember[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useMemberMutations() {
  const qc = useQueryClient()
  const { session } = useAuth()
  const { household } = useHousehold()
  const hid = household?.id ?? null
  const key = membersKey(hid)

  /** Rename yourself; the column-level grant enforces scope server-side. */
  const updateDisplayName = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Name required')
      const { error } = await supabase
        .from('household_members')
        .update({ display_name: trimmed })
        .eq('household_id', hid!)
        .eq('user_id', session!.user.id)
      if (error) throw error
    },
    onMutate: async (name) => {
      qc.setQueryData<HouseholdMember[]>(key, (old) =>
        old?.map((m) =>
          m.user_id === session?.user.id ? { ...m, display_name: name.trim() } : m,
        ),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: MEMBERS_KEY }),
  })

  return { updateDisplayName }
}

export function memberName(
  members: HouseholdMember[] | undefined,
  userId: string | null,
): string {
  if (!userId) return 'Anyone'
  return members?.find((m) => m.user_id === userId)?.display_name ?? 'Someone'
}
