import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import { canViewActivityLog } from "@/lib/permissions";
import NavBar from "@/components/NavBar";
import ActivityLogTable from "@/components/ActivityLogTable";

export default async function ActivityLogsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const publicUser = toPublicUser(user);
  if (!canViewActivityLog(publicUser)) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <h1 className="text-lg font-semibold">Activity Logs</h1>
      <ActivityLogTable />
    </div>
  );
}
