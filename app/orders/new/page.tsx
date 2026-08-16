import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { toPublicUser } from "@/lib/publicUser";
import { canCreateOrder } from "@/lib/permissions";
import NavBar from "@/components/NavBar";
import NewOrderForm from "@/components/NewOrderForm";

export default async function NewOrderPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const publicUser = toPublicUser(user);
  if (!canCreateOrder(publicUser)) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-24 pt-6 sm:px-6">
      <NavBar user={publicUser} />
      <h1 className="mb-4 text-lg font-semibold">New Order</h1>
      <NewOrderForm />
    </div>
  );
}
