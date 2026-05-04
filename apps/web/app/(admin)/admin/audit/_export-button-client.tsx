"use client";

import { useState } from "react";
import { toastSuccess, toastApiError } from "@/lib/toast";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonSpinner } from "@/components/ui/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/auth/client";

interface Props {
  currentParams: string;
}

export function ExportButtonClient({ currentParams }: Props) {
  const [working, setWorking] = useState(false);

  async function download() {
    setWorking(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toastApiError(null, "Couldn't export audit log", "Please sign in again.");
        return;
      }
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

      const params = new URLSearchParams(currentParams);
      params.delete("page");
      params.delete("limit");

      const res = await fetch(
        `${apiUrl}/api/v1/admin/audit/export.csv?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (res.status === 413) {
        toastApiError(null, "Couldn't export audit log", "Narrow filters and try again.");
        return;
      }
      if (!res.ok) {
        toastApiError(null, "Couldn't export audit log", `HTTP ${res.status}`);
        return;
      }

      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="?([^";]+)"?/i.exec(cd);
      const filename =
        match?.[1] ?? `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toastSuccess("Audit log exported", "Download started.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Button
      onClick={download}
      disabled={working}
      variant="outline"
      className="rounded-[var(--radius-pill)]"
    >
      {working ? <ButtonSpinner /> : <Download className="mr-1 h-3 w-3" />}
      {working ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
