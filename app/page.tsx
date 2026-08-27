import { CodexExplorer } from "@/components/codex-explorer";
import { cookies } from "next/headers";
import { DEFAULT_WORKSPACE, isWorkspace, WORKSPACE_COOKIE_NAME } from "@/lib/workspace";

export default async function Home() {
  const savedWorkspace = (await cookies()).get(WORKSPACE_COOKIE_NAME)?.value;
  return <CodexExplorer initialWorkspace={isWorkspace(savedWorkspace) ? savedWorkspace : DEFAULT_WORKSPACE} />;
}
