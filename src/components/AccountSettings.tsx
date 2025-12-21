import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Trash2, AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const AccountSettings = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    
    setIsDeleting(true);
    try {
      // Delete user data from all tables
      if (user) {
        // First get goal IDs for this user
        const { data: goals } = await supabase
          .from('goals')
          .select('id')
          .eq('user_id', user.id);
        
        const goalIds = goals?.map(g => g.id) || [];
        
        // Delete in order respecting foreign keys
        await supabase.from('chat_messages').delete().eq('user_id', user.id);
        if (goalIds.length > 0) {
          await supabase.from('reading_plan_books').delete().in('goal_id', goalIds);
        }
        await supabase.from('goals').delete().eq('user_id', user.id);
        await supabase.from('reading_sessions').delete().eq('user_id', user.id);
        await supabase.from('bookmarks').delete().eq('user_id', user.id);
        await supabase.from('categories').delete().eq('user_id', user.id);
        await supabase.from('user_preferences').delete().eq('user_id', user.id);
        await supabase.from('profiles').delete().eq('user_id', user.id);
      }

      // Sign out the user (account deletion requires admin SDK in backend)
      await signOut();
      
      toast({
        title: "Account data deleted",
        description: "Your data has been removed. Please contact support to fully delete your account.",
      });
      
      navigate("/landing");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description: "Failed to delete account data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setConfirmText("");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Account settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Account Settings
            </DialogTitle>
            <DialogDescription>
              Manage your account preferences and data
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Account Info */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Email</Label>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>

            {/* Danger Zone */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Danger Zone
              </h4>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will permanently delete all your data including reading history, bookmarks, and preferences.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Account Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action cannot be undone. All your data will be permanently deleted:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Reading history and progress</li>
                <li>Saved bookmarks and notes</li>
                <li>Reading plans and goals</li>
                <li>Chat history</li>
                <li>Preferences and settings</li>
              </ul>
              <div className="pt-3">
                <Label htmlFor="confirm-delete" className="text-foreground font-medium">
                  Type DELETE to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="DELETE"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={confirmText !== "DELETE" || isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
