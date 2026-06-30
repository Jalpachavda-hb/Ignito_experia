import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Lab } from './schema'
import { apiRequest } from '@/services/api'

const mapApiToLab = (apiLab: Record<string, any>): Lab => ({
  id: (apiLab.labCode || apiLab.id || String(apiLab.dbId)) as string,
  dbId: apiLab.dbId as number,
  title: (apiLab.title || 'Untitled') as string,
  subtitle: (apiLab.subtitle || '') as string,
  semester: (apiLab.semester || '') as string,
  logoUrl: (apiLab.logoUrl || apiLab.logo || '') as string,
  category: (apiLab.category || '') as string,
  credits: (apiLab.credits || 0) as number,
  durationMinutes: (apiLab.durationMinutes || 60) as number,
  complexity: (apiLab.complexity || '') as string,
  runtimeType: (apiLab.runtimeType || apiLab.runtime?.type || 'ide') as string,
  runtimePort: (apiLab.runtimePort || null) as number | null,
  runtimePath: (apiLab.runtimePath || '') as string,
  containerApiEnabled: Boolean(apiLab.containerApiEnabled),
  containerApiPort: (apiLab.containerApiPort || null) as number | null,
  taskDefinition: (apiLab.taskDefinition || '') as string,
  description: (apiLab.description || '') as string,
  status: (apiLab.status || 'active') as Lab['status'],
  displayOrder: (apiLab.displayOrder || 0) as number,
  isDeleted: Boolean(apiLab.isDeleted),
  createdAt: apiLab.createdAt ? new Date(apiLab.createdAt as string) : new Date(),
  updatedAt: apiLab.updatedAt ? new Date(apiLab.updatedAt as string) : new Date(),
})

const mapLabToPayload = (lab: Partial<Lab>) => ({
  labCode: lab.id || `lab-${Date.now()}`,
  title: lab.title,
  subtitle: lab.subtitle || '',
  semester: lab.semester || '',
  logoUrl: lab.logoUrl || '',
  durationMinutes: lab.durationMinutes,
  credits: lab.credits,
  complexity: lab.complexity || '',
  category: lab.category || '',
  description: lab.description || '',
  runtimeType: lab.runtimeType || 'ide',
  runtimePort: lab.runtimePort || null,
  runtimePath: lab.runtimePath || '',
  containerApiEnabled: lab.containerApiEnabled || false,
  containerApiPort: lab.containerApiPort || null,
  taskDefinition: lab.taskDefinition || '',
  displayOrder: lab.displayOrder || 0,
})

export function useLabsQuery(status?: string) {
  return useQuery({
    queryKey: ['owner-labs', status],
    queryFn: async (): Promise<Lab[]> => {
      const url = status ? `/admin/labs?status=${status}` : '/admin/labs'
      const data = await apiRequest<{ labs: any[] }>(url)
      if (data?.labs && Array.isArray(data.labs)) {
        return data.labs.map((l) => mapApiToLab(l))
      }
      return []
    },
  })
}

export function useRuntimeTypesQuery() {
  return useQuery({
    queryKey: ['owner-runtime-types'],
    queryFn: async (): Promise<{ value: string; label: string }[]> => {
      try {
        const data = await apiRequest<{ runtimeTypes: { value: string; label: string }[] }>('/admin/runtime-types')
        return data?.runtimeTypes || []
      } catch {
        return []
      }
    },
  })
}

export function useCreateLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Lab>) => {
      return await apiRequest('/admin/labs', {
        method: 'POST',
        body: JSON.stringify(mapLabToPayload(payload)),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-labs'] })
      toast.success('Lab created successfully!')
    },
    onError: (err: Error) => {
      toast.error('Failed to create lab: ' + err.message)
    },
  })
}

export function useUpdateLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ labId, payload }: { labId: string; payload: Partial<Lab> }) => {
      return await apiRequest(`/admin/labs/${labId}`, {
        method: 'PUT',
        body: JSON.stringify(mapLabToPayload(payload)),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-labs'] })
      toast.success('Lab updated successfully!')
    },
    onError: (err: Error) => {
      toast.error('Failed to update lab: ' + err.message)
    },
  })
}

export function useUpdateLabStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ labId, status }: { labId: string; status: string }) => {
      return await apiRequest(`/admin/labs/${labId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-labs'] })
      toast.success('Lab status updated!')
    },
    onError: (err: Error) => {
      toast.error('Failed to update status: ' + err.message)
    },
  })
}

export function useDeleteLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (labId: string) => {
      return await apiRequest(`/admin/labs/${labId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-labs'] })
      toast.success('Lab deleted successfully!')
    },
    onError: (err: Error) => {
      toast.error('Failed to delete lab: ' + err.message)
    },
  })
}
