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
   * "switcher" — user is an existing recruiter creating a second workspace;
   *              after success we set it active + go to /recruiter.
   * "onboarding" — first-time signup; after success we continue to the
   *                About step at /onboarding/recruiter.
   */
  mode: "switcher" | "onboarding";
}

export function CompanyCreateForm({ mode }: CompanyCreateFormProps) {
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
    onSuccess: (res) => {
      if (mode === "switcher") {
        setActiveCompanyId(res.data.id);
        queryClient.clear();
        toastSuccess(`Workspace ${res.data.name} created`);
        router.push("/recruiter");
        router.refresh();
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
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
              <FormLabel>Company Size</FormLabel>
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
              <FormLabel>Headquarters Location</FormLabel>
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
        <div className="flex justify-between pt-4">
          {mode === "onboarding" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/onboarding/start")}
              className="rounded-[var(--radius-pill)] px-8"
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            disabled={createCompany.isPending}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {createCompany.isPending && <ButtonSpinner />}
            {createCompany.isPending
              ? "Creating..."
              : mode === "switcher"
                ? "Create workspace"
                : "Next"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
