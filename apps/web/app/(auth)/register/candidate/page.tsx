import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Sign Up as Candidate" };

export default function RegisterCandidatePage() {
  return (
    <div className="flex justify-center py-8">
      <SignUp
        routing="hash"
        signInUrl="/login"
        unsafeMetadata={{ role: "candidate" }}
        appearance={{ variables: { colorPrimary: "#2563eb" } }}
      />
    </div>
  );
}
