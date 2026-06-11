import { type Role, MODULES } from '../data/schema'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Shield, Users, Edit2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RoleCardProps {
  role: Role
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
}

export function RoleCard({ role, onEdit, onDelete }: RoleCardProps) {
  // Calculate permission summary
  let totalActive = 0
  const maxPossible = MODULES.length * 4 // 4 actions per module

  MODULES.forEach(mod => {
    const p = role.permissions[mod]
    if (p) {
      if (p.create) totalActive++
      if (p.read) totalActive++
      if (p.update) totalActive++
      if (p.delete) totalActive++
    }
  })

  const accessPercentage = Math.round((totalActive / maxPossible) * 100)
  
  let accessBadge = 'Low Access'
  let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline'

  if (accessPercentage > 80) {
    accessBadge = 'Full Access'
    badgeVariant = 'default'
  } else if (accessPercentage > 40) {
    accessBadge = 'Moderate Access'
    badgeVariant = 'secondary'
  }

  return (
    <Card className="flex flex-col h-full border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <Badge variant={badgeVariant}>{accessBadge}</Badge>
        </div>
        <CardTitle className="text-xl">{role.name}</CardTitle>
        <CardDescription className="line-clamp-2 h-10 mt-1">
          {role.description || 'No description provided.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{Intl.NumberFormat('en-US').format(role.userCount)}</span>
            <span className="text-muted-foreground">assigned users</span>
          </div>
          
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Permissions Active</span>
              <span className="font-medium">{totalActive} / {maxPossible}</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${accessPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4 border-t border-border/50 gap-2">
        <Button 
          variant="outline" 
          className="flex-1 bg-transparent hover:bg-muted/50"
          onClick={() => onEdit(role)}
        >
          <Edit2 className="h-4 w-4 mr-2" />
          Edit Role
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive border-border/50"
          onClick={() => onDelete(role)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
