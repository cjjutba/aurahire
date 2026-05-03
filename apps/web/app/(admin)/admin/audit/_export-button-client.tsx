"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        toast.error("Please sign in");
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
        toast.error("Export too large", {
          description: "Narrow filters and try again.",
        });
        return;
      }
      if (!res.ok) {
        toast.error("Export failed", { description: `HTTP ${res.status}` });
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
      toast.success("Export downloaded");
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
      <Download className="mr-1 h-3 w-3" />
      {working ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
