import { buildSeedCouple } from "@/lib/db/seed";
import { TaskBoard } from "@/components/fairy/TaskBoard";

/**
 * Task delegation board (Task 15 / Req 5). Shell chrome (sticky header, tabs,
 * disclaimer) is provided by the (tabs) layout.
 *
 * Tasks come from the data model. On this branch the agent that extracts call
 * results into tasks (Person B) is not wired in, so the seed workspace starts
 * with no tasks (`tasks: []`) and each column shows its calm empty state. The
 * board itself fully supports populated tasks and the His-track readiness
 * update; `readinessScore` seeds the His meter from the male partner's profile.
 */
export default function TasksPage() {
  const workspace = buildSeedCouple();

  return (
    <TaskBoard
      tasks={workspace.tasks}
      readinessScore={workspace.himProfile.readiness_score ?? 0}
    />
  );
}
