import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/fairy/EmptyState";

// Placeholder for Task 14 (Couple Workspace: Her / His / Together views and
// the workflow viewer). The shell, header, and disclaimer come from the
// (tabs) layout.
export default function HomePage() {
  return (
    <EmptyState
      icon={Sparkles}
      title="Your workspace is taking shape"
      description="Her, His, and Together views with your trying window, readiness, and the workflow steps will appear here."
    />
  );
}
