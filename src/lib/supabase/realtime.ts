'use client'

import { useEffect, useState } from 'react'
import { createClient } from './client'
import { RealtimePostgresInsertPayload } from '@supabase/supabase-js'

export function useSupabaseRealtime<T extends Record<string, unknown>>(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = 'INSERT',
  callback?: (payload: RealtimePostgresInsertPayload<T>) => void
) {
  const [lastPayload, setLastPayload] = useState<RealtimePostgresInsertPayload<T> | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`realtime_${table}_${event}`)
      .on(
        'postgres_changes',
        {
          event: event,
          schema: 'public',
          table: table,
        },
        (payload) => {
          setLastPayload(payload as RealtimePostgresInsertPayload<T>)
          if (callback) callback(payload as RealtimePostgresInsertPayload<T>)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, callback, supabase])

  return lastPayload
}

export function subscribeToCommercialActivities(callback: (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => void) {
  const supabase = createClient()
  return supabase
    .channel('commercial_activities_changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'commercial_activities' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback as any // O supabase-js espera um callback genérico, mantemos o cast interno mas tipamos a interface
    )
    .subscribe()
}
