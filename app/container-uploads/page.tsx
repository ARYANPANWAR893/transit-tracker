import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import { canActOnFulfillment } from "@/lib/permissions";
import NavBar from "@/components/NavBar";
import ContainerUploadForm from "@/components/ContainerUploadForm";
import ContainerUploadsList from "@/components/ContainerUploadsList";

export default async function ContainerUploadsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const publicUser = toPublicUser(user);
  if (!canActOnFulfillment(publicUser)) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <h1 className="text-lg font-semibold">Container Uploads</h1>
      <ContainerUploadForm />
      <ContainerUploadsList />
    </div>
  );
}
