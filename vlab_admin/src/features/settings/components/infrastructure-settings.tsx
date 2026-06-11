import { useForm } from 'react-hook-form'
import { FormShell } from './form-shell'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Cloud, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'

export function InfrastructureSettings() {
  const { register, formState: { isDirty }, reset, setValue } = useForm({
    defaultValues: {
      awsRegion: 'us-east-1',
      ecsCluster: 'vlab-production-cluster',
      taskDef: 'kali-linux-task:v4',
      vpcId: 'vpc-0a1b2c3d4e5f',
      subnetIds: 'subnet-1, subnet-2'
    }
  })

  const handleTestConnection = async () => {
    toast.promise(sleep(2000), {
      loading: 'Pinging AWS API...',
      success: 'Connected to AWS region us-east-1 successfully.',
      error: 'Connection timeout',
    })
  }

  return (
    <FormShell 
      title="AWS & Infrastructure" 
      description="Manage cloud provider connections and core infrastructure routing."
      isDirty={isDirty}
      onReset={() => reset()}
    >
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6 space-y-6">
          
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-card mb-6">
            <div className="p-2 bg-amber-500/10 rounded-md">
              <Cloud className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <h4 className="font-medium text-sm flex items-center gap-2">
                AWS Connection Active
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </h4>
              <p className="text-xs text-muted-foreground">IAM Role: arn:aws:iam::1234567890:role/VlabAdminRole</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={handleTestConnection}>
              Test Connection
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>AWS Region</Label>
              <Select defaultValue="us-east-1" onValueChange={(val) => setValue('awsRegion', val, { shouldDirty: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us-east-1">us-east-1 (N. Virginia)</SelectItem>
                  <SelectItem value="us-west-2">us-west-2 (Oregon)</SelectItem>
                  <SelectItem value="eu-central-1">eu-central-1 (Frankfurt)</SelectItem>
                  <SelectItem value="ap-south-1">ap-south-1 (Mumbai)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>ECS Cluster Name</Label>
              <Input {...register('ecsCluster')} />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label>Base Task Definition</Label>
              <Input {...register('taskDef')} />
              <p className="text-xs text-muted-foreground mt-1">Default task family used for provisioning new lab environments.</p>
            </div>

            <div className="space-y-2">
              <Label>VPC ID</Label>
              <Input {...register('vpcId')} className="font-mono text-sm" />
            </div>

            <div className="space-y-2">
              <Label>Subnet IDs (Comma separated)</Label>
              <Input {...register('subnetIds')} className="font-mono text-sm" />
            </div>
          </div>

        </CardContent>
      </Card>
    </FormShell>
  )
}
