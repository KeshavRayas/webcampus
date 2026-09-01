import { AuthSignInView } from "@/modules/auth/sign-in/auth-sign-in-view";

export default function HomePage() {
  return <AuthSignInView initialRole="student" />;
}
