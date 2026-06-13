import { ListChecks } from "lucide-react";

import { EmptyState } from "@/components/fairy/EmptyState";

// Placeholder for Task 15 (Task delegation board). Shell chrome is provided
// by the (tabs) layout.
export default function TasksPage() {
  return (
    <EmptyState
      icon={ListChecks}
      title="No tasks yet"
      description="Follow-ups from your insurance and clinic calls will be split across Her, His, and Together here."
    />
  );
}
