import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Container } from 'lucide-react'

export function DockerConfigSettings() {
  const { register, formState: { isDirty }, reset, setValue } = useForm({
    defaultValues: {
      registryUrl: 'registry.hub.docker.com',
      repository: 'vlab-official',
      runtime: 'runc',
      timeout: 300,
      memLimit: '4g',
      cpuLimit: '2.0'
    }
  })

  return (
    <FormShell 
      title="Docker Configuration" 
      description="Manage container runtimes, registries, and hard limits for virtual labs."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <div className="grid gap-6">
        
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Container className="h-5 w-5 text-sky-500" />
              Registry & Runtime
            </CardTitle>
            <CardDescription>Configure where container images are pulled from.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 md:col-span-2">
              <Label>Docker Registry URL</Label>
              <Input {...register('registryUrl')} className="font-mono text-sm" />
            </div>
            
            <div className="space-y-2">
              <Label>Image Repository Base</Label>
              <Input {...register('repository')} className="font-mono text-sm" />
            </div>
            
            <div className="space-y-2">
              <Label>Default Runtime</Label>
              <Select defaultValue="runc" onValueChange={(val) => setValue('runtime', val, { shouldDirty: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Runtime" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="runc">runc (Default)</SelectItem>
                  <SelectItem value="containerd">containerd</SelectItem>
                  <SelectItem value="kata">kata-containers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm border-amber-500/20">
          <CardHeader>
            <CardTitle>Resource Limits (Hard Caps)</CardTitle>
            <CardDescription>Absolute maximums that cannot be exceeded by any single lab instance.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Global Memory Limit</Label>
              <Input {...register('memLimit')} placeholder="e.g. 4g, 8192m" className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Docker memory limit flag (-m)</p>
            </div>
            
            <div className="space-y-2">
              <Label>Global CPU Limit</Label>
              <Input {...register('cpuLimit')} placeholder="e.g. 2.0" className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground mt-1">Docker CPU quotas (--cpus)</p>
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label>Container Startup Timeout (Seconds)</Label>
              <Input type="number" {...register('timeout')} />
              <p className="text-xs text-muted-foreground mt-1">If a container fails to reach 'running' state in this time, it is killed.</p>
            </div>
          </CardContent>
        </Card>

      </div>
    </FormShell>
  )
}
