import { SignUp } from "@clerk/nextjs";

export const metadata = { title: "Sign Up as Recruiter" };

export default function RegisterRecruiterPage() {
  return (
    <div className="flex justify-center py-8">
      <SignUp
        routing="hash"
        signInUrl="/login"
        unsafeMetadata={{ role: "recruiter" }}
        appearance={{ variables: { colorPrimary: "#2563eb" } }}
      />
    </div>
  );
}
