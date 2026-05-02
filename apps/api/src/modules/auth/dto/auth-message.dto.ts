import { ApiProperty } from "@nestjs/swagger";

export class AuthMessageDto {
  @ApiProperty() message!: string;
}

export class VerifyEmailResponseDto {
  @ApiProperty({ enum: ["candidate", "recruiter"] }) role!: "candidate" | "recruiter";
  @ApiProperty() email!: string;
  @ApiProperty({
    description:
      "One-time Supabase magic-link token_hash. Frontend calls supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) to establish a session.",
  })
  sessionTokenHash!: string;
}
