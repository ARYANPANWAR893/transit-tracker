import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import NavBar from "@/components/NavBar";
import ProductsPageClient from "@/components/ProductsPageClient";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const publicUser = toPublicUser(user);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <ProductsPageClient canEdit={publicUser.role === "ADMIN" || publicUser.role === "EDITOR"} />
    </div>
  );
}
