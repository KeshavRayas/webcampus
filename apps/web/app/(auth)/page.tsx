import { AuthSignInView } from "@/modules/auth/sign-in/auth-sign-in-view";
import React from "react";

const HomePage = () => {
  return <AuthSignInView initialRole="student" />;
};

export default HomePage;
