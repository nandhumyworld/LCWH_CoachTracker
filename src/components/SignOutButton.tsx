import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

// Server-action sign-out button. Reusable across role areas.
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="sm">
        Sign out
      </Button>
    </form>
  );
}
