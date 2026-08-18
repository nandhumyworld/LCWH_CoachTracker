"use client";

import { use } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { setPasswordAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Set password"}
    </Button>
  );
}

export default function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = use(searchParams);
  const [state, formAction] = useActionState<ActionState, FormData>(
    setPasswordAction,
    {},
  );

  const succeeded = !!state.done;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invalid link</CardTitle>
            <CardDescription>
              This invite link is missing its token. Ask your coach to resend
              it.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>Choose a password to activate your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {succeeded ? (
            <div className="space-y-4">
              <p className="text-sm">Your password is set.</p>
              <Button asChild className="w-full">
                <Link href="/login">Go to sign in</Link>
              </Button>
            </div>
          ) : (
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="token" value={token} />
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              {state.error && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}
              <SubmitButton />
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
