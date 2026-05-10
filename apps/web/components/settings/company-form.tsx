"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  COMPANY_SIZE,
  updateCompanySchema,
  type UpdateCompanyInput,
} from "@aurahire/shared";

import { toastApiError, toastSuccess } from "@/lib/toast";
import {
  useCompanyMeQuery,
  useUpdateCompanyMutation,
  type CompanyDetail,
} from "@/hooks/use-company";

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

interface CompanyFormProps {
  /** Skipped on first render — the query takes over once it resolves. */
  initial?: CompanyDetail | null;
}

/**
 * Owner/admin-facing form for the active company. Shape mirrors the
 * onboarding company-create form but uses the patch endpoint and seeds
 * from /companies/me.
 *
 * Empty strings on optional URL/text fields are normalised to `null` on
 * submit so the Zod `.url()` rule on `website` doesn't reject a cleared
 * input.
 */
export function CompanyForm({ initial }: CompanyFormProps) {
  const query = useCompanyMeQuery(!initial);
  const data = initial ?? query.data?.data ?? null;

  const form = useForm<UpdateCompanyInput>({
    resolver: zodResolver(updateCompanySchema),
    defaultValues: toFormValues(data),
  });

  // Re-seed when the query resolves (initial is null on first load).
  useEffect(() => {
    if (data) form.reset(toFormValues(data));
  }, [data, form]);

  const update = useUpdateCompanyMutation();

  async function onSubmit(values: UpdateCompanyInput) {
    const payload: UpdateCompanyInput = {
      ...values,
      industry: values.industry || null,
      website: values.website || null,
      logoUrl: values.logoUrl || null,
      headquartersLocation: values.headquartersLocation || null,
      description: values.description || null,
    };
    try {
      await update.mutateAsync(payload);
      toastSuccess("Company saved");
    } catch (err) {
      toastApiError(err, "Couldn't save company");
    }
  }

  if (!data && query.isLoading) {
    return (
      <p className="text-sm text-[var(--color-muted)]">Loading company…</p>
    );
  }
  if (!data) {
    return (
      <p className="text-sm text-[var(--color-status-danger)]">
        Failed to load company. Refresh to try again.
      </p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company name *</FormLabel>
              <FormControl>
                <Input
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
              <FormLabel>Industry</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Software"
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
              <FormLabel>Company size</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ?? undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
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
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://"
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
              <FormLabel>Headquarters location</FormLabel>
              <FormControl>
                <Input
                  placeholder="City, Country"
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
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://cdn.example.com/logo.png"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                Direct upload is coming. For now, paste a public URL.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea rows={4} {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={update.isPending || !form.formState.isDirty}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {update.isPending && <ButtonSpinner />}
            {update.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function toFormValues(c: CompanyDetail | null): UpdateCompanyInput {
  if (!c) {
    return {
      name: "",
      industry: "",
      size: undefined,
      website: "",
      logoUrl: "",
      headquartersLocation: "",
      description: "",
    };
  }
  return {
    name: c.name,
    industry: c.industry,
    size: (c.size as UpdateCompanyInput["size"]) ?? undefined,
    website: c.website,
    logoUrl: c.logoUrl,
    headquartersLocation: c.headquartersLocation,
    description: c.description,
  };
}
