"use client";

import { useQueryClient } from "@tanstack/react-query";

import { RealtimeEvent } from "@/lib/realtime";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import {
  useApplicationDetailQuery,
  useApplicationInterviewsQuery,
  useApplicationOffersQuery,
} from "@/hooks/use-applications";
import {
  ApplicationDetailClient,
  type AppDetail,
} from "./_application-detail-client";

interface InterviewRow {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  status: string;
  locationOrLink: string | null;
  venueName?: string | null;
  addressLine?: string | null;
  roomOrFloor?: string | null;
  candidateSummary?: string | null;
  sharedWithCandidateAt?: string | null;
}

interface OfferRow {
  id: string;
  status: string;
  title: string;
  salary: number;
  salaryCurrency: string;
  startDate: string;
  managerName: string | null;
  benefitsSummary: string | null;
  customMessage: string | null;
  expiresAt: string | null;
  sentAt: string;
  respondedAt: string | null;
}

interface ApplicationDetailDataClientProps {
  applicationId: string;
  /** Server-rendered initial data passed as fallback while client hydrates */
  initialApp: AppDetail;
  initialInterviews: InterviewRow[];
  initialPendingOffer: OfferRow | null;
  initialPastOffers: OfferRow[];
}

export function ApplicationDetailDataClient({
  applicationId,
  initialApp,
  initialInterviews,
  initialPendingOffer,
  initialPastOffers,
}: ApplicationDetailDataClientProps) {
  const queryClient = useQueryClient();

  const { data: appData } = useApplicationDetailQuery(applicationId);
  const { data: interviewsData } = useApplicationInterviewsQuery(applicationId);
  const { data: offersData } = useApplicationOffersQuery(applicationId);

  // Invalidate whenever a status change, interview, or offer arrives for THIS application.
  useRealtimeChannel(RealtimeEvent.ApplicationStatusChanged, (payload) => {
    if (payload.applicationId !== applicationId) return;
    queryClient.invalidateQueries({
      queryKey: ["candidate-applications", "detail", applicationId],
    });
    queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
  });

  // Async scoring: when the worker finishes, refetch detail so the
  // AiShimmer placeholder swaps for the rendered score ring + breakdown.
  useRealtimeChannel(RealtimeEvent.ApplicationScored, (payload) => {
    if (payload.applicationId !== applicationId) return;
    queryClient.invalidateQueries({
      queryKey: ["candidate-applications", "detail", applicationId],
    });
    queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
  });

  useRealtimeChannel(RealtimeEvent.InterviewScheduled, (payload) => {
    if (payload.applicationId !== applicationId) return;
    queryClient.invalidateQueries({
      queryKey: ["candidate-applications", "interviews", applicationId],
    });
    queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
    queryClient.invalidateQueries({ queryKey: ["candidate-interviews"] });
  });

  useRealtimeChannel(RealtimeEvent.InterviewStatusChanged, (payload) => {
    if (payload.applicationId !== applicationId) return;
    queryClient.invalidateQueries({
      queryKey: ["candidate-applications", "interviews", applicationId],
    });
    queryClient.invalidateQueries({ queryKey: ["candidate-interviews"] });
  });

  useRealtimeChannel(RealtimeEvent.OfferSent, (payload) => {
    if (payload.applicationId !== applicationId) return;
    queryClient.invalidateQueries({
      queryKey: ["candidate-applications", "offers", applicationId],
    });
    queryClient.invalidateQueries({ queryKey: ["candidate-applications"] });
  });

  // Resolve live data vs. server-rendered initial props.
  const app = (appData?.data as AppDetail | undefined) ?? initialApp;

  const allOffers = (offersData?.data as OfferRow[] | undefined) ?? [
    ...(initialPendingOffer ? [initialPendingOffer] : []),
    ...initialPastOffers,
  ];
  const pendingOffer = allOffers.find((o) => o.status === "pending") ?? null;
  const pastOffers = allOffers.filter((o) => o.status !== "pending");

  const interviews =
    (interviewsData?.data as InterviewRow[] | undefined) ?? initialInterviews;

  return (
    <ApplicationDetailClient
      app={app}
      interviews={interviews}
      pendingOffer={pendingOffer}
      pastOffers={pastOffers}
    />
  );
}
