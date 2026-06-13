import { MessageCircleHeart } from "lucide-react";

import { EmptyState } from "@/components/fairy/EmptyState";

// Placeholder for Task 18 (Grounded chat). Shell chrome is provided by the
// (tabs) layout.
export default function ChatPage() {
  return (
    <EmptyState
      icon={MessageCircleHeart}
      title="Ask about your prep"
      description="Why these days are priority, what to do this week, what to ask the doctor — answered from your data, with sources."
    />
  );
}
