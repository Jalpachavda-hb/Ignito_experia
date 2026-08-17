import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lab } from './schema'
import { fetchAdminLabs, fetchRuntimeTypes } from '@/Utils/GetApiHandler'
import {
  updateAdminLabStatus,
  updateAdminLab,
  deleteAdminLab,
  createAdminLab,
} from '@/Utils/PostApiHandler'

/**
 * Read-only Lab Consumption Queries for VLab Dashboard (Student & Super Admin).
 * Lab Management (Create, Edit, Delete, Status Toggle) is performed exclusively
 * in the Owner Dashboard.
 */

// Map the DB response to the original frontend Lab schema
const mapApiToFrontendLab = (apiLab: any): Lab => {
  return {
    id: apiLab.labCode || apiLab.id || String(apiLab.dbId),
    title: apiLab.title || 'Untitled Lab',
    subtitle: apiLab.subtitle || '',
    program: apiLab.program || '',
    semester: apiLab.semester || '',
    logoUrl: apiLab.logoUrl || apiLab.logo || '',
    category: apiLab.category || 'Development',
    credits: apiLab.credits || 0,
    durationMinutes: apiLab.durationMinutes || 60,
    complexity: apiLab.complexity || 'Intermediate',
    runtimeType: apiLab.runtimeType || apiLab.runtime?.type || 'IDE',
    runtimePort: apiLab.runtimePort || null,
    runtimePath: apiLab.runtimePath || '',
    containerApiPath: apiLab.containerApiPath || '',
    taskDefinition: apiLab.taskDefinition || apiLab.dockerImage || 'ubuntu:latest',
    instructions: apiLab.instructions || '',
    status: apiLab.status || 'active',
    deletedAt: apiLab.deletedAt ? new Date(apiLab.deletedAt) : undefined,
    deletedBy: apiLab.deletedBy || '',
    createdAt: apiLab.createdAt ? new Date(apiLab.createdAt) : new Date(),
    updatedAt: apiLab.updatedAt ? new Date(apiLab.updatedAt) : new Date()
  }
}

// Queries
export function useLabsQuery(status?: string) {
  return useQuery({
    queryKey: ['labs', status],
    queryFn: async (): Promise<Lab[]> => {
      const params = status && status !== 'all' ? { status } : undefined
      const data: any = await fetchAdminLabs(params)
      // API returns { labs: [...] }
      if (data && data.labs && Array.isArray(data.labs)) {
        return data.labs.map(mapApiToFrontendLab)
      }
      return []
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useRuntimeTypesQuery() {
  return useQuery({
    queryKey: ['runtime-types'],
    queryFn: async (): Promise<{ value: string, label: string }[]> => {
      try {
        const data: any = await fetchRuntimeTypes()
        if (data && data.runtimeTypes && Array.isArray(data.runtimeTypes)) {
          return data.runtimeTypes
        }
        return []
      } catch (e) {
        console.error("Failed to fetch runtime types", e)
        return []
      }
    }
  })
}

export function useUpdateLabStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ labId, status }: { labId: string; status: string }) => {
      return await updateAdminLabStatus(labId, status)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
      toast.success('Lab status updated!')
    },
    onError: (err: Error) => {
      toast.error('Failed to update status: ' + err.message)
    },
  })
}

export function useUpdateLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ labId, payload }: { labId: string; payload: Partial<Lab> }) => {
      return await updateAdminLab(labId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
      toast.success('Lab updated successfully!')
    },
    onError: (err: Error) => {
      toast.error('Failed to update lab: ' + err.message)
    },
  })
}

export function useDeleteLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (labId: string) => {
      return await deleteAdminLab(labId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
      toast.success('Lab deleted successfully!')
    },
    onError: (err: Error) => {
      toast.error('Failed to delete lab: ' + err.message)
    },
  })
}

export function useCreateLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Lab>) => {
      return await createAdminLab(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
      toast.success('Lab created successfully!')
    },
    onError: (err: Error) => {
      toast.error('Failed to create lab: ' + err.message)
    },
  })
}


