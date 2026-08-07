import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import NavBar from "@/components/NavBar";
import UserManager from "@/components/UserManager";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const publicUser = toPublicUser(user);
  if (publicUser.role !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <UserManager currentUserId={publicUser.id} />
    </div>
  );
}
