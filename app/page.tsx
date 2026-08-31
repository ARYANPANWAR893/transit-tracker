import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import { canViewRequirements } from "@/lib/permissions";
import NavBar from "@/components/NavBar";
import RequirementsDashboard from "@/components/RequirementsDashboard";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const publicUser = toPublicUser(user);
  // Alice works only from containers, so send her straight there.
  if (!canViewRequirements(publicUser)) redirect("/containers");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <RequirementsDashboard currentUser={publicUser} />
    </div>
  );
}
