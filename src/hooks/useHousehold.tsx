import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Household } from '../lib/types'
import { useAuth } from './useAuth'
import HouseholdSetup from '../pages/HouseholdSetup'

interface HouseholdState {
  household: Household | null
  role: 'owner' | 'member' | null
  loading: boolean
}

const HouseholdContext = createContext<HouseholdState>({
  household: null,
  role: null,
  loading: true,
})

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id

  const { data, isLoading } = useQuery({
    queryKey: ['household', userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ household: Household; role: 'owner' | 'member' } | null> => {
      const { data, error } = await supabase
        .from('household_members')
        .select('role, households(id, name, invite_code)')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data?.households) return null
      return {
        household: data.households as unknown as Household,
        role: data.role as 'owner' | 'member',
      }
    },
    staleTime: 5 * 60_000,
  })

  return (
    <HouseholdContext.Provider
      value={{
        household: data?.household ?? null,
        role: data?.role ?? null,
        loading: isLoading,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  return useContext(HouseholdContext)
}

/** Create/join mutations; both reset all caches since the data scope changes. */
export function useHouseholdMutations() {
  const qc = useQueryClient()
  const reset = () => qc.clear()

  const createHousehold = useMutation({
    mutationFn: async (name: string): Promise<Household> => {
      const { data, error } = await supabase.rpc('create_household', { p_name: name })
      if (error) throw error
      return data as Household
    },
    onSuccess: reset,
  })

  const joinHousehold = useMutation({
    mutationFn: async (code: string): Promise<{ id: string; name: string }> => {
      const { data, error } = await supabase.rpc('join_household', { p_code: code })
      if (error) throw error
      return data as { id: string; name: string }
    },
    onSuccess: reset,
  })

  return { createHousehold, joinHousehold }
}

/** Blocks the app until the user belongs to a household. */
export function HouseholdGate({ children }: { children: ReactNode }) {
  const { household, loading } = useHousehold()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <div className="skeleton h-10 w-10 rounded-full" />
      </div>
    )
  }
  if (!household) return <HouseholdSetup />
  return <>{children}</>
}
