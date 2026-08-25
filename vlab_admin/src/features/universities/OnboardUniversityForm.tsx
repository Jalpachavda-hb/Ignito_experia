import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface OnboardUniversityFormProps {
  onBack: () => void
}

export function OnboardUniversityForm({ onBack }: OnboardUniversityFormProps) {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Onboard New University</h1>
          <p className="text-xs text-muted-foreground">Register a new university tenant in Ignito Experia</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-border p-6 rounded-2xl bg-card">
        <div className="space-y-1">
          <label className="text-xs font-semibold">University Name</label>
          <Input placeholder="e.g. Gujarat Technological University" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">University Code</label>
          <Input placeholder="e.g. GTU" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Admin Email</label>
          <Input placeholder="e.g. admin@gtu.ac.in" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Contact Phone</label>
          <Input placeholder="e.g. +91 98765 43210" />
        </div>
        <div className="col-span-2 pt-4 flex gap-3">
          <Button onClick={onBack}>Save University</Button>
          <Button variant="outline" onClick={onBack}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
