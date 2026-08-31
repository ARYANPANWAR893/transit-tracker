import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import NavBar from "@/components/NavBar";
import ContainersList from "@/components/ContainersList";

export default async function ContainersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const publicUser = toPublicUser(user);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <h1 className="mb-4 text-lg font-semibold">Containers</h1>
      <ContainersList currentUser={publicUser} />
    </div>
  );
}
