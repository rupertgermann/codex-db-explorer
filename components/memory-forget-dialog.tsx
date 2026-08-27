"use client";

import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ForgetPlan, ForgetResult, ForgetSection } from "@/lib/memory-forget";
import { cn } from "@/lib/utils";

export type ForgetRecheck = { status: "suppressed" | "resurfaced"; resurfaced: ForgetSection[] };

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  plan: ForgetPlan | null;
  result: ForgetResult | null;
  recheck: ForgetRecheck | null;
  confirmedDurableIds: string[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, confirmed: boolean) => void;
  onRefresh: () => void;
  onApply: () => void;
  onRecheck: () => void;
};

export function MemoryForgetDialog({ open, loading, error, plan, result, recheck, confirmedDurableIds, onOpenChange, onConfirm, onRefresh, onApply, onRecheck }: Props) {
  const needsSourceConfirmation = plan && (plan.durableCandidates.length > 1 || plan.durableCandidates.some(({ match }) => match === "related"));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Forget this Memory?</DialogTitle>
          <DialogDescription>Review every exact section first. Nothing is changed until you apply the confirmed plan.</DialogDescription>
        </DialogHeader>
        {loading && !plan ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Building read-only preview…</div> : null}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        {plan && <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-xs"><p className="font-semibold">Selected summary entry</p><p className="mt-1 text-muted-foreground">{plan.target}</p></div>
          {needsSourceConfirmation && !result && <div className="space-y-2">
            <p className="text-xs font-semibold">Confirm the durable sources</p>
            {plan.durableCandidates.map((candidate) => <label key={candidate.id} className="flex gap-2 rounded-lg border p-3 text-xs"><input type="checkbox" checked={confirmedDurableIds.includes(candidate.id)} onChange={(event) => onConfirm(candidate.id, event.target.checked)} /><span><b>{candidate.path}:{candidate.startLine}</b><span className="mt-1 block text-muted-foreground">{candidate.content.trim()}</span>{candidate.signals?.length ? <span className="mt-1 block text-[10px] text-indigo-600">Matched by {candidate.signals.join(", ")}</span> : null}</span></label>)}
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading || confirmedDurableIds.length === 0}><RefreshCw className={cn("size-3.5", loading && "animate-spin")} />Update plan</Button>
          </div>}
          {plan.reason && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{plan.reason}</p>}
          {plan.sections.length > 0 && <div className="space-y-2"><p className="text-xs font-semibold">Exact affected sections ({plan.sections.length})</p>{plan.sections.map((section) => <div key={section.id} className="rounded-lg border p-3 text-xs"><div className="flex items-center justify-between gap-2"><Badge variant="secondary">{section.kind}</Badge><span className="font-mono text-[10px] text-muted-foreground">{section.path}:{section.startLine}-{section.endLine}</span></div><pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] text-muted-foreground">{section.content.trim()}</pre></div>)}</div>}
          {result && <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><p className="font-semibold">Memory removed and verified; delete tombstone written.</p><p>Tombstone: {result.tombstonePath}</p><div><p className="font-medium">Changed artifacts ({result.changedPaths.length})</p><ul className="mt-1 list-disc pl-4 font-mono text-[10px]">{result.changedPaths.map((path) => <li key={path}>{path}</li>)}</ul></div><p className="break-all font-mono text-[10px]">Backup: {result.manifestPath}</p></div>}
          {recheck && <div className={cn("rounded-lg border p-3 text-xs", recheck.status === "suppressed" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>{recheck.status === "suppressed" ? "No positive copy currently appears in the Memory corpus." : `Memory resurfaced in ${recheck.resurfaced.map(({ path }) => path).join(", ")}.`}</div>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Close</Button>{result ? <Button onClick={onRecheck} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Recheck now</Button> : <Button variant="destructive" onClick={onApply} disabled={!plan.actionable || loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Apply Forget plan</Button>}</div>
        </div>}
      </DialogContent>
    </Dialog>
  );
}
