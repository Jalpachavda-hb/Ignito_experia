'use client'

import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { type Role, MODULES, MODULE_LABELS, permissionSchema } from '../data/schema'
import { createRole, updateRole } from '@/services/rolesService'

const formSchema = z.object({
  name: z.string().min(1, 'Role name is required.'),
  description: z.string().optional(),
  permissions: z.record(z.string(), permissionSchema),
  isEdit: z.boolean(),
})
type RoleForm = z.infer<typeof formSchema>

type RoleActionDialogProps = {
  currentRow?: Role
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const buildDefaultPermissions = () => {
  const perms: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }> = {}
  MODULES.forEach((mod) => {
    perms[mod] = { create: false, read: false, update: false, delete: false }
  })
  return perms
}

export function RoleActionDialog({
  currentRow,
  open,
  onOpenChange,
  onSuccess,
}: RoleActionDialogProps) {
  const isEdit = !!currentRow

  const form = useForm<RoleForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: buildDefaultPermissions(),
      isEdit: false,
    },
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (currentRow) {
        // Merge existing permissions with defaults so all modules are shown
        const mergedPermissions = buildDefaultPermissions()
        if (currentRow.permissions) {
          Object.entries(currentRow.permissions).forEach(([mod, perm]) => {
            mergedPermissions[mod] = perm
          })
        }
        form.reset({
          name: currentRow.name,
          description: currentRow.description || '',
          permissions: mergedPermissions,
          isEdit: true,
        })
      } else {
        form.reset({
          name: '',
          description: '',
          permissions: buildDefaultPermissions(),
          isEdit: false,
        })
      }
    }
  }, [open, currentRow])

  const mutation = useMutation({
    mutationFn: async (values: RoleForm) => {
      const payload = {
        name: values.name,
        description: values.description,
        permissions: values.permissions,
      }
      if (isEdit && currentRow) {
        return updateRole(currentRow.roleId, payload)
      }
      return createRole(payload)
    },
    onSuccess: () => {
      toast.success(`Role ${isEdit ? 'updated' : 'created'} successfully!`)
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (err: any) => {
      toast.error(err?.message || `Failed to ${isEdit ? 'update' : 'create'} role.`)
    },
  })

  const onSubmit = (values: RoleForm) => {
    mutation.mutate(values)
  }

  const toggleModuleAll = (moduleName: string, checked: boolean) => {
    form.setValue(`permissions.${moduleName}` as any, {
      create: checked,
      read: checked,
      update: checked,
      delete: checked,
    }, { shouldDirty: true })
  }

  const isModuleAllChecked = (moduleName: string) => {
    const perms = form.watch(`permissions.${moduleName}` as any)
    return perms?.create && perms?.read && perms?.update && perms?.delete
  }

  const isModuleIndeterminate = (moduleName: string) => {
    const perms = form.watch(`permissions.${moduleName}` as any)
    if (!perms) return false
    const values = Object.values(perms)
    const some = values.some(Boolean)
    const all = values.every(Boolean)
    return some && !all
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Role' : 'Create New Role'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Modify the role and its permission matrix.' : 'Define a new role and its access levels.'}
          </DialogDescription>
        </DialogHeader>
        <div className='flex-1 overflow-y-auto px-1 py-4'>
          <Form {...form}>
            <form id='role-form' onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role Name</FormLabel>
                      <FormControl>
                        <Input placeholder='e.g. Lab Coordinator' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='description'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder='Briefly describe this role...' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3">Permission Matrix</h4>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[220px]">Module</TableHead>
                        <TableHead className="text-center">Select All</TableHead>
                        <TableHead className="text-center">Create</TableHead>
                        <TableHead className="text-center">Read</TableHead>
                        <TableHead className="text-center">Update</TableHead>
                        <TableHead className="text-center">Delete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {MODULES.map((moduleName) => (
                        <TableRow key={moduleName}>
                          <TableCell className="font-medium text-sm">
                            {MODULE_LABELS[moduleName]}
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox 
                              checked={isModuleAllChecked(moduleName) || (isModuleIndeterminate(moduleName) && 'indeterminate')}
                              onCheckedChange={(checked) => toggleModuleAll(moduleName, !!checked)}
                            />
                          </TableCell>
                          {(['create', 'read', 'update', 'delete'] as const).map((action) => (
                            <TableCell key={`${moduleName}-${action}`} className="text-center">
                              <FormField
                                control={form.control}
                                name={`permissions.${moduleName}.${action}` as any}
                                render={({ field }) => (
                                  <FormItem className="space-y-0 inline-flex items-center">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </form>
          </Form>
        </div>
        <DialogFooter className='pt-2'>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type='submit' form='role-form' disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mutation.isPending ? 'Saving...' : 'Save Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
