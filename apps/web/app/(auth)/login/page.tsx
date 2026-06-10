import { SignIn } from "@clerk/nextjs";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="flex justify-center py-8">
      <SignIn
        routing="hash"
        signUpUrl="/register"
        appearance={{ variables: { colorPrimary: "#2563eb" } }}
      />
    </div>
  );
}
