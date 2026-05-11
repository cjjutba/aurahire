"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  InviteMemberInput,
  TransferOwnershipInput,
  UpdateMemberInput,
} from "@aurahire/shared";

import { clientApiFetch } from "./_client-fetch";
import { MEMBERSHIPS_QUERY_KEY } from "./use-membership";

export type MemberRole = "owner" | "admin" | "recruiter";
export type MemberStatus = "invited" | "active" | "suspended" | "left";

export interface MemberUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

export interface CompanyMember {
  id: string;
  companyId: string;
  userId: string | null;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  invitationToken: string | null;
  invitationExpiresAt: string | null;
  invitedBy: string | null;
  inviterName: string | null;
  invitedAt: string;
  joinedAt: string | null;
  removedAt: string | null;
  user: MemberUser | null;
}

export interface MembersListEnvelope {
  data: CompanyMember[];
}

export interface MemberEnvelope {
  data: CompanyMember;
}

interface MemberRemovedResponse {
  data: { removed: true; memberId: string };
}

export const MEMBERS_QUERY_KEY = ["company-members"] as const;

/**
 * GET /api/v1/companies/me/members, single envelope listing both
 * active members and pending invites. Status is on each row.
 */
export function useMembersQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: MEMBERS_QUERY_KEY,
    queryFn: ({ signal }) =>
      clientApiFetch<MembersListEnvelope>("/api/v1/companies/me/members", {
        signal,
      }),
    enabled,
  });
}

export function useInviteMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: InviteMemberInput) =>
      clientApiFetch<MemberEnvelope>("/api/v1/companies/me/members", {
        method: "POST",
        body: values,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
    },
  });
}

export function useUpdateMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { memberId: string; values: UpdateMemberInput }) =>
      clientApiFetch<MemberEnvelope>(
        `/api/v1/companies/me/members/${params.memberId}`,
        {
          method: "PATCH",
          body: params.values,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MEMBERSHIPS_QUERY_KEY });
    },
  });
}

export function useRemoveMemberMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      clientApiFetch<MemberRemovedResponse>(
        `/api/v1/companies/me/members/${memberId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MEMBERSHIPS_QUERY_KEY });
    },
  });
}

export function useResendInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      clientApiFetch<MemberEnvelope>(
        `/api/v1/companies/me/members/${memberId}/resend-invitation`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
    },
  });
}

/**
 * POST /api/v1/companies/me/members/:id/transfer-ownership, owner only.
 * On success the caller's role is downgraded to admin and the target
 * member becomes the owner. Memberships query is invalidated so the
 * sidebar reflects the new role label.
 */
export function useTransferOwnershipMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      memberId: string;
      values: TransferOwnershipInput;
    }) =>
      clientApiFetch<MemberEnvelope>(
        `/api/v1/companies/me/members/${params.memberId}/transfer-ownership`,
        {
          method: "POST",
          body: params.values,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEMBERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MEMBERSHIPS_QUERY_KEY });
    },
  });
}
