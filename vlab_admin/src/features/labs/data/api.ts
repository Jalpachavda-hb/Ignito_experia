import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lab } from './schema'
import { apiRequest } from '@/lib/apiClient'

// Map the DB response to the original frontend Lab schema
const mapApiToFrontendLab = (apiLab: any): Lab => {
  return {
    id: apiLab.labCode || apiLab.id || String(apiLab.dbId),
    title: apiLab.title || 'Untitled Lab',
    subtitle: apiLab.subtitle || '',
    program: apiLab.program || '',
    semester: apiLab.semester || '',
    logoUrl: apiLab.logoUrl || '',
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
    status: apiLab.status || 'maintenance',
    deletedAt: apiLab.deletedAt ? new Date(apiLab.deletedAt) : undefined,
    deletedBy: apiLab.deletedBy || '',
    createdAt: apiLab.createdAt ? new Date(apiLab.createdAt) : new Date(),
    updatedAt: apiLab.updatedAt ? new Date(apiLab.updatedAt) : new Date()
  }
}

// Map the frontend Lab payload back to what the backend expects
const mapFrontendToApiPayload = (lab: Partial<Lab>) => {
  return {
    labCode: lab.id || `lab-${Date.now()}`,
    title: lab.title,
    subtitle: lab.subtitle || '',
    program: lab.program || '',
    semester: lab.semester || '',
    logoUrl: lab.logoUrl || '',
    durationMinutes: lab.durationMinutes,
    credits: lab.credits,
    complexity: lab.complexity || 'Intermediate',
    category: lab.category,
    runtimeType: lab.runtimeType || 'ide',
    runtimePort: lab.runtimePort || null,
    runtimePath: lab.runtimePath || '',
    containerApiPath: lab.containerApiPath || '',
    taskDefinition: lab.taskDefinition || '',
    instructions: lab.instructions || '',
    status: lab.status || 'maintenance',
  }
}

// Queries
export function useLabsQuery(status?: string) {
  return useQuery({
    queryKey: ['labs', status],
    queryFn: async (): Promise<Lab[]> => {
      const url = status ? `/admin/labs?status=${status}` : '/admin/labs'
      const data = await apiRequest(url)
      // API returns { labs: [...] }
      if (data && data.labs && Array.isArray(data.labs)) {
        return data.labs.map(mapApiToFrontendLab)
      }
      return []
    }
  })
}

export function useRuntimeTypesQuery() {
  return useQuery({
    queryKey: ['runtime-types'],
    queryFn: async (): Promise<{ value: string, label: string }[]> => {
      try {
        const data = await apiRequest('/admin/runtime-types')
        if (data && data.runtimeTypes && Array.isArray(data.runtimeTypes)) {
          return data.runtimeTypes
        }
        return []
      } catch (e) {
        console.error("Failed to fetch runtime types", e)
        return [
          { value: 'ide', label: 'IDE' },
          { value: 'terminal', label: 'Terminal' },
          { value: 'jupyter', label: 'Jupyter Notebook' },
          { value: 'codeserver', label: 'Code Server (VSCode)' },
        ]
      }
    }
  })
}

// Mutations
export function useCreateLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Lab>) => {
      const apiPayload = mapFrontendToApiPayload(payload)
      return await apiRequest('/admin/labs', {
        method: 'POST',
        body: JSON.stringify(apiPayload)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
    }
  })
}

export function useUpdateLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ labId, payload }: { labId: string, payload: Partial<Lab> }) => {
      const apiPayload = mapFrontendToApiPayload(payload)
      return await apiRequest(`/admin/labs/${labId}`, {
        method: 'PUT',
        body: JSON.stringify(apiPayload)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
    }
  })
}

export function useUpdateLabStatusMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ labId, status }: { labId: string, status: string }) => {
      return await apiRequest(`/admin/labs/${labId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
      toast.success('Status updated successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to update status: ' + (error?.message || 'Unknown error'))
    }
  })
}

export function useDeleteLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (labId: string) => {
      return await apiRequest(`/admin/labs/${labId}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
    }
  })
}

export function useRestoreLabMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (labId: string) => {
      return await apiRequest(`/admin/labs/${labId}/restore`, {
        method: 'POST'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labs'] })
    }
  })
}
