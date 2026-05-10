"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { inviteMemberSchema, type InviteMemberInput } from "@aurahire/shared";

import { toastApiError, toastSuccess } from "@/lib/toast";
import { useInviteMemberMutation } from "@/hooks/use-members";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface MembersInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Email + role invite. The server enforces the actual role rules
 * (owner-only, single-pending-per-email, etc.); we surface the canned
 * "admin" / "recruiter" options because owners are minted only at
 * company creation or via explicit transfer-ownership.
 */
export function MembersInviteDialog({
  open,
  onOpenChange,
}: MembersInviteDialogProps) {
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "recruiter" },
  });
  const invite = useInviteMemberMutation();

  async function onSubmit(values: InviteMemberInput) {
    try {
      await invite.mutateAsync(values);
      toastSuccess(
        "Invitation sent",
        `An email is on its way to ${values.email}.`,
      );
      form.reset({ email: "", role: "recruiter" });
      onOpenChange(false);
    } catch (err) {
      toastApiError(err, "Couldn't send invitation");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            They'll get an email with a one-time link to accept the invitation.
            Roles can be changed later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="invite-member-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder="name@company.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">
                        Admin — manage team, edit company
                      </SelectItem>
                      <SelectItem value="recruiter">
                        Recruiter — post jobs, review candidates
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={invite.isPending}
            className="rounded-[var(--radius-pill)] px-6"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="invite-member-form"
            disabled={invite.isPending}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 hover:bg-[var(--color-primary-active)]"
          >
            {invite.isPending && <ButtonSpinner />}
            {invite.isPending ? "Sending..." : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MembersInviteButtonProps {
  /**
   * Empty state and toolbar both need to launch the dialog. The button is
   * stateful so callers don't need to manage `open`.
   */
  className?: string;
  label?: string;
}

export function MembersInviteButton({
  className,
  label = "Invite member",
}: MembersInviteButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-6 hover:bg-[var(--color-primary-active)]"
        }
      >
        {label}
      </Button>
      <MembersInviteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
