import { Banknote, FileQuestion, Handshake, Lightbulb, PackageX } from "lucide-react";

/** Business problems from docs/plan.md (OPS business_problem), with the playbook that works each one. */
export const AREA: Record<string, { label: string; icon: typeof Lightbulb; playbook: string }> = {
  shortage_recovery: { label: "Shortage recovery", icon: PackageX, playbook: "shortage-dispute" },
  deduction_visibility: { label: "Unexplained deductions", icon: FileQuestion, playbook: "unexplained-deductions" },
  cash_collection: { label: "Cash collection", icon: Banknote, playbook: "cash-collection" },
  coop: { label: "Co-op", icon: Handshake, playbook: "" },
};

/** Which business problem a recommendation's action_type belongs to. */
export const AREA_OF_ACTION: Record<string, string> = {
  dispute_shortage: "shortage_recovery",
  price_fix: "shortage_recovery",
  resolve_deduction: "deduction_visibility",
  chase_payment: "cash_collection",
  coop_review: "coop",
};
