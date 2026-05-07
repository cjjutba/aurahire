"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createCompanySchema,
  type CreateCompanyInput,
  COMPANY_SIZE,
} from "@aurahire/shared";

import { clientApiFetch } from "@/hooks/_client-fetch";
import { MEMBERSHIPS_QUERY_KEY } from "@/hooks/use-membership";
import { setActiveCompanyId } from "@/lib/active-company";
import { toastApiError, toastSuccess } from "@/lib/toast";

import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface CreateCompanyResponse {
  data: {
    id: string;
    name: string;
  };
}

interface CompanyCreateFormProps {
  /**
   * "switcher"   — existing recruiter creating a second workspace via the
   *                full /onboarding/recruiter/company-create?from=switcher
   *                page. Success → /recruiter.
   * "onboarding" — first-time signup. Success → /onboarding/recruiter.
   * "dialog"     — sidebar modal. Success → onSuccess() to close + refresh.
   */
  mode: "switcher" | "onboarding" | "dialog";
  /** Called after a successful create in `dialog` mode. */
  onSuccess?: () => void;
  /** Called when the user cancels in `dialog` mode. */
  onCancel?: () => void;
}

export function CompanyCreateForm({
  mode,
  onSuccess,
  onCancel,
}: CompanyCreateFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: "",
      industry: "",
      size: undefined,
      website: "",
      headquartersLocation: "",
      description: "",
    },
  });

  const createCompany = useMutation({
    mutationFn: (values: CreateCompanyInput) =>
      clientApiFetch<CreateCompanyResponse>("/api/v1/companies", {
        method: "POST",
        body: values,
      }),
    onSuccess: async (res) => {
      if (mode === "switcher") {
        setActiveCompanyId(res.data.id);
        queryClient.clear();
        toastSuccess(`Company ${res.data.name} created`);
        router.push("/recruiter");
        router.refresh();
      } else if (mode === "dialog") {
        // Sidebar modal — switch active company, drop the previous tenant's
        // cached lists, force memberships to refetch (so the sidebar chip
        // flips to the new company before we close), refresh server
        // components, then close.
        setActiveCompanyId(res.data.id);
        queryClient.clear();
        await queryClient.fetchQuery({
          queryKey: MEMBERSHIPS_QUERY_KEY,
          queryFn: () =>
            clientApiFetch("/api/v1/profiles/me/memberships"),
        });
        toastSuccess(`Company ${res.data.name} created`);
        router.refresh();
        onSuccess?.();
      } else {
        // Onboarding path — backend already set last_active_company_id.
        // Mirror it client-side so the next /recruiter render carries the
        // header on every fetch from the start.
        setActiveCompanyId(res.data.id);
        queryClient.invalidateQueries();
        router.push("/onboarding/recruiter");
      }
    },
    onError: (err) => toastApiError(err, "Couldn't create company"),
  });

  async function onSubmit(values: CreateCompanyInput) {
    // Normalise "" → null/undefined for nullable optional fields so Zod's
    // `.url()` validator on `website` doesn't reject empty strings.
    const payload: CreateCompanyInput = {
      ...values,
      industry: values.industry || null,
      website: values.website || null,
      headquartersLocation: values.headquartersLocation || null,
      description: values.description || null,
    };
    await createCompany.mutateAsync(payload);
  }

  const inputCls =
    "h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";
  const textareaCls =
    "min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-soft)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20";
  const labelCls =
    "text-sm font-semibold text-[var(--color-ink)]";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Company Name *</FormLabel>
              <FormControl>
                <Input
                  className={inputCls}
                  placeholder="e.g. Acme Inc."
                  autoComplete="organization"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="industry"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Industry (Optional)</FormLabel>
              <FormControl>
                <Input
                  className={inputCls}
                  placeholder="e.g. Software, Finance, Healthcare"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="size"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Company Size (Optional)</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? null}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COMPANY_SIZE.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="website"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Website (Optional)</FormLabel>
              <FormControl>
                <Input
                  className={inputCls}
                  type="url"
                  placeholder="https://example.com"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="headquartersLocation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Headquarters Location (Optional)</FormLabel>
              <FormControl>
                <Input
                  className={inputCls}
                  placeholder="e.g. San Francisco, USA"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={labelCls}>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  className={textareaCls}
                  rows={4}
                  placeholder="A short description of what your company does and the kinds of teams you hire for."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--color-hairline-soft)] pt-6">
          {mode === "onboarding" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/onboarding/start")}
              className="h-11 rounded-[var(--radius-pill)] border-[var(--color-hairline)] bg-[var(--color-surface-strong)] px-8 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-hairline)]"
            >
              Back
            </Button>
          ) : mode === "dialog" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel?.()}
              disabled={createCompany.isPending}
              className="h-11 rounded-[var(--radius-pill)] border-[var(--color-hairline)] bg-[var(--color-surface-strong)] px-8 text-sm font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-hairline)]"
            >
              Cancel
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            disabled={createCompany.isPending}
            className="h-11 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-active)] disabled:cursor-not-allowed disabled:bg-[var(--color-primary-disabled)]"
          >
            {createCompany.isPending && <ButtonSpinner />}
            {createCompany.isPending
              ? "Creating..."
              : mode === "onboarding"
                ? "Continue"
                : "Create company"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
