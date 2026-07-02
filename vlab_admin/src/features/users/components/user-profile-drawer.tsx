import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { type User } from '../data/schema'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Activity, Database, Server, User as UserIcon, BookOpen, GraduationCap } from 'lucide-react'

type UserProfileDrawerProps = {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserProfileDrawer({ user, open, onOpenChange }: UserProfileDrawerProps) {
  if (!user) return null

  const initials = user.FullName ? user.FullName.substring(0, 2).toUpperCase() : 'U'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="p-6 pb-0 border-b border-border/50 bg-muted/20">
          <div className="flex items-start gap-4 mb-6">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.FullName}`} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-2xl font-bold">{user.FullName}</SheetTitle>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {user.Email}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Badge variant="outline" className="bg-primary/5 capitalize">
                  <UserIcon className="h-3 w-3 mr-1" />
                  {user.Role}
                </Badge>
                {user.ProgramId && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <BookOpen size={12} />
                    {user.ProgramId}
                  </Badge>
                )}
                {user.SemesterId && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <GraduationCap size={12} />
                    {user.SemesterId}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="w-full grid grid-cols-4 h-12 bg-muted/50">
              <TabsTrigger value="profile" className="text-xs sm:text-sm">Profile</TabsTrigger>
              <TabsTrigger value="credits" className="text-xs sm:text-sm">Credits</TabsTrigger>
              <TabsTrigger value="labs" className="text-xs sm:text-sm">Labs</TabsTrigger>
              <TabsTrigger value="sessions" className="text-xs sm:text-sm">Sessions</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6 space-y-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Account Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                      <p className="font-semibold mt-1">{user.PhoneNumber || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Available Credits</p>
                      <div className="text-2xl font-bold mt-1 text-amber-600 flex items-center">
                        <Database className="h-4 w-4 mr-1.5" />
                        {Intl.NumberFormat('en-US').format(Number(user.CreditBalance))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Member Since</p>
                      <p className="font-semibold mt-1">
                        {new Date(user.CreatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="credits" className="mt-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Credit History
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200">
                      {Intl.NumberFormat('en-US').format(Number(user.CreditBalance))} Balance
                    </Badge>
                  </CardTitle>
                  <CardDescription>Recent credit allocations and deductions.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Mock History Items */}
                    {[
                      { type: 'Allocated', amount: 5000, desc: 'Semester Start Grant', date: 'Oct 01, 2024' },
                      { type: 'Consumed', amount: -450, desc: 'Cybersec Lab Instance', date: 'Oct 15, 2024' },
                      { type: 'Consumed', amount: -120, desc: 'Ubuntu Base Environment', date: 'Oct 18, 2024' },
                    ].map((tx, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                        <div>
                          <p className="font-medium text-sm">{tx.desc}</p>
                          <p className="text-xs text-muted-foreground">{tx.date}</p>
                        </div>
                        <div className={`font-semibold ${tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="labs" className="mt-6">
              <Card className="border-border/50 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Lab History</CardTitle>
                  <CardDescription>Previously provisioned lab environments.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { name: 'Ubuntu Base', os: 'Linux', duration: '2h 15m', date: 'Oct 18, 2024' },
                      { name: 'Kali Linux - Pentesting', os: 'Linux', duration: '4h 00m', date: 'Oct 15, 2024' },
                      { name: 'Windows Server 2022', os: 'Windows', duration: '1h 30m', date: 'Oct 10, 2024' },
                    ].map((lab, i) => (
                      <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-muted/20">
                        <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <Server className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{lab.name}</p>
                          <p className="text-xs text-muted-foreground">{lab.os}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{lab.duration}</p>
                          <p className="text-xs text-muted-foreground">{lab.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions" className="mt-6">
              <Card className="border-border/50 shadow-sm border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-emerald-500 animate-pulse" />
                    Active Sessions
                  </CardTitle>
                  <CardDescription>Currently running containers for this user.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-6 border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center bg-muted/10">
                    <Server className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm font-medium">No active sessions</p>
                    <p className="text-xs text-muted-foreground mt-1">This user doesn't have any running labs right now.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
