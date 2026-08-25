import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Phone, Mail, Lock, Loader2, Save } from 'lucide-react';
import { updateUserProfile } from '@/Utils/PostApiHandler';
import { fetchAuthMe } from '@/Utils/GetApiHandler';
import { useAuthStore } from '@/stores/auth-store';
import { toast } from 'sonner';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialMobile: string;
  email: string;
}

export function EditProfileModal({
  isOpen,
  onClose,
  initialName,
  initialMobile,
  email,
}: EditProfileModalProps) {
  const [fullName, setFullName] = useState(initialName || '');
  const [mobile, setMobile] = useState(initialMobile || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFullName(initialName || '');
    setMobile(initialMobile || '');
  }, [initialName, initialMobile, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !fullName.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!mobile || !mobile.trim()) {
      toast.error('Mobile number is required');
      return;
    }

    try {
      setLoading(true);
      const res: any = await updateUserProfile({
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        phoneNumber: mobile.trim(),
      });

      if (res?.success) {
        toast.success('Profile details updated successfully!');
        
        // Refresh local auth state
        const meData: any = await fetchAuthMe().catch(() => null);
        if (meData?.user) {
          useAuthStore.getState().auth.setUser({
            ...meData.user,
            userId: meData.user.id || meData.user.userId,
            fullName: meData.user.fullName || meData.user.name,
            exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
          });
        }
        onClose();
      } else {
        toast.error(res?.message || 'Failed to update profile');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <User className="h-5 w-5 text-red-600" />
            Edit Profile Details
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update your personal name and contact mobile number. Email address cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="editFullName" className="flex items-center gap-1.5 text-xs font-semibold">
              <User className="h-3.5 w-3.5 text-muted-foreground" /> Full Name
            </Label>
            <Input
              id="editFullName"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {/* Mobile Number */}
          <div className="space-y-1.5">
            <Label htmlFor="editMobile" className="flex items-center gap-1.5 text-xs font-semibold">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Contact / Mobile Number
            </Label>
            <Input
              id="editMobile"
              type="text"
              placeholder="Enter mobile number"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              required
            />
          </div>

          {/* Email Address (Read-only / Disabled) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="editEmail" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email Address
              </Label>
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Cannot be changed
              </span>
            </div>
            <Input
              id="editEmail"
              type="email"
              value={email}
              disabled
              className="bg-muted/50 cursor-not-allowed opacity-80"
            />
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
