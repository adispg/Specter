import { redirect } from "next/navigation";

/**
 * /sign-up redirects to /sign-in. The sign-in page handles both new and
 * returning users: submitting an email creates an account if one does not
 * exist yet, so there is no separate sign-up flow.
 */
export default function SignUpPage() {
  redirect("/sign-in");
}
