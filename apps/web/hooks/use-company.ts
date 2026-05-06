"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  DeleteCompanyInput,
  UpdateCompanyInput,
} from "@aurahire/shared";

import { clientApiFetch } from "./_client-fetch";
import { MEMBERSHIPS_QUERY_KEY } from "./use-membership";

export interface CompanyDetail {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
  website: string | null;
  logoUrl: string | null;
  headquartersLocation: string | null;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyEnvelope {
  data: CompanyDetail;
}

export const COMPANY_ME_QUERY_KEY = ["company-me"] as const;

/**
 * GET /api/v1/companies/me — returns the caller's currently active company.
 * Re-keyed implicitly by the X-Active-Company-Id header (clientApiFetch
 * forwards it). On `switchCompany()` the QueryClient is cleared so the
 * cache can't leak across tenants.
 */
export function useCompanyMeQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: COMPANY_ME_QUERY_KEY,
    queryFn: ({ signal }) =>
      clientApiFetch<CompanyEnvelope>("/api/v1/companies/me", { signal }),
    enabled,
  });
}

/**
 * PATCH /api/v1/companies/me — owner/admin only. Updates the editable
 * fields on the active company; on success we invalidate both the
 * /companies/me query (so the form re-seeds with normalized values) and
 * the memberships list (the sidebar switcher reads `companyName` /
 * `companyLogoUrl` from there).
 */
export function useUpdateCompanyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: UpdateCompanyInput) =>
      clientApiFetch<CompanyEnvelope>("/api/v1/companies/me", {
        method: "PATCH",
        body: values,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMPANY_ME_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MEMBERSHIPS_QUERY_KEY });
    },
  });
}

interface DeleteCompanyResponse {
  data: { deleted: true; companyId: string };
}

/**
 * DELETE /api/v1/companies/me — owner only. Body must echo the company
 * name as a typo guard. The caller is responsible for clearing the
 * active-company singleton + redirecting after success.
 */
export function useDeleteCompanyMutation() {
  return useMutation({
    mutationFn: (values: DeleteCompanyInput) =>
      clientApiFetch<DeleteCompanyResponse>("/api/v1/companies/me", {
        method: "DELETE",
        body: values,
      }),
  });
}

interface LeaveCompanyResponse {
  data: { left: true; nextActiveCompanyId: string | null };
}

/**
 * POST /api/v1/companies/me/leave — any active member. Backend rejects
 * if the caller is the last owner of the company.
 */
export function useLeaveCompanyMutation() {
  return useMutation({
    mutationFn: () =>
      clientApiFetch<LeaveCompanyResponse>("/api/v1/companies/me/leave", {
        method: "POST",
      }),
  });
}
