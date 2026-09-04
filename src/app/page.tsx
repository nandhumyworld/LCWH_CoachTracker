import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homePathForRole } from "@/lib/auth-helpers";
import type { AppRole } from "@/types/next-auth";

// Root `/` has no landing page: send signed-in users to their role home,
// everyone else to the login screen.
export default async function Home() {
  const session = await auth();
  const role = session?.user?.role as AppRole | undefined;

  redirect(role ? homePathForRole(role) : "/login");
}
