"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { recruiterCompanySchema, type RecruiterCompany } from "@aurahire/shared";
import { useRecruiterProfilesControllerUpdateCompanyV1 } from "@aurahire/shared";
import { Button } from "@/components/ui/button";
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

const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
] as const;

interface CompanyFormProps {
  defaults: RecruiterCompany;
}

export function RecruiterCompanyForm({ defaults }: CompanyFormProps) {
  const router = useRouter();

  const form = useForm<RecruiterCompany>({
    resolver: zodResolver(recruiterCompanySchema),
    defaultValues: defaults,
  });

  const updateCompany = useRecruiterProfilesControllerUpdateCompanyV1({
    mutation: {
      onSuccess: () => router.push("/onboarding/recruiter/focus"),
      onError: (err) =>
        toast.error("Save failed", { description: (err as Error).message }),
    },
  });

  async function onSubmit(values: RecruiterCompany) {
    await updateCompany.mutateAsync({ data: values });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input {...field} />
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
                  {COMPANY_SIZES.map((s) => (
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
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/onboarding/recruiter")}
            className="rounded-[var(--radius-pill)] px-8"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={updateCompany.isPending}
            className="rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-8 hover:bg-[var(--color-primary-active)]"
          >
            {updateCompany.isPending ? "Saving..." : "Next"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
