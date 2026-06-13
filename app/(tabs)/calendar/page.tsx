import { CalendarHeart } from "lucide-react";

import { EmptyState } from "@/components/fairy/EmptyState";

// Placeholder for Task 16 (Shared Calendar). Shell chrome is provided by the
// (tabs) layout.
export default function CalendarPage() {
  return (
    <EmptyState
      icon={CalendarHeart}
      title="No dates to show yet"
      description="Your trying window, priority days, reminders, and the June 25 consult will land here once intake runs."
    />
  );
}
