import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import { prisma } from "@/lib/prisma";
import { serializeContainerDetail, CONTAINER_DETAIL_INCLUDE } from "@/lib/containerSerializer";
import NavBar from "@/components/NavBar";
import ContainerDetailClient from "@/components/ContainerDetailClient";

/** "What's in this container?" — the Container -> Products direction. */
export default async function ContainerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const publicUser = toPublicUser(user);

  const { id } = await params;
  const container = await prisma.container.findUnique({ where: { id }, include: CONTAINER_DETAIL_INCLUDE });
  if (!container) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <ContainerDetailClient container={serializeContainerDetail(container)} currentUser={publicUser} />
    </div>
  );
}
