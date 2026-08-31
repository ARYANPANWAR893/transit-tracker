import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import { canCreateRequirement } from "@/lib/permissions";
import NavBar from "@/components/NavBar";
import NewRequirementForm from "@/components/NewRequirementForm";

export default async function NewRequirementPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const publicUser = toPublicUser(user);
  if (!canCreateRequirement(publicUser)) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <h1 className="mb-4 text-lg font-semibold">New Requirement</h1>
      <NewRequirementForm />
    </div>
  );
}
