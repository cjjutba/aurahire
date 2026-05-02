import { Body, Controller, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import { Public } from "../../common/decorators/public.decorator";
import { AuthService } from "./auth.service";
import { SignupCandidateDto } from "./dto/signup-candidate.dto";
import { SignupRecruiterDto } from "./dto/signup-recruiter.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthMessageDto, VerifyEmailResponseDto } from "./dto/auth-message.dto";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("signup-candidate")
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Sign up a candidate (creates Supabase user, sends verification email)",
    description:
      "Backend-owned signup: creates the Supabase auth user with email_confirm=false, issues a single-use verification token, and emails the link via Mailpit (dev) or Resend (prod). The profile row is created on /verify-email.",
  })
  @ApiResponse({ status: 202, type: AuthMessageDto })
  @ApiResponse({ status: 409, description: "Email already registered (and confirmed)" })
  async signupCandidate(
    @Body() dto: SignupCandidateDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthMessageDto> {
    return this.authService.signupCandidate(dto, this.requestMeta(req));
  }

  @Post("signup-recruiter")
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Sign up a recruiter (creates Supabase user, sends verification email)",
  })
  @ApiResponse({ status: 202, type: AuthMessageDto })
  @ApiResponse({ status: 409, description: "Email already registered (and confirmed)" })
  async signupRecruiter(
    @Body() dto: SignupRecruiterDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthMessageDto> {
    return this.authService.signupRecruiter(dto, this.requestMeta(req));
  }

  @Post("verify-email")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Verify an email-verification token",
    description:
      "Consumes the token, marks the Supabase user as email-confirmed, creates the profile + role-specific subprofile, and writes audit logs.",
  })
  @ApiResponse({ status: 200, type: VerifyEmailResponseDto })
  @ApiResponse({ status: 400, description: "Token invalid, expired, or already used" })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: FastifyRequest,
  ): Promise<VerifyEmailResponseDto> {
    return this.authService.verifyEmail(dto.token, this.requestMeta(req));
  }

  @Post("resend-verification")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Resend the verification email",
    description: "Always returns 200; never discloses whether an account exists.",
  })
  @ApiResponse({ status: 200, type: AuthMessageDto })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthMessageDto> {
    return this.authService.resendVerification(dto.email, this.requestMeta(req));
  }

  @Post("forgot-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Request a password reset email",
    description: "Always returns 200; never discloses whether an account exists.",
  })
  @ApiResponse({ status: 200, type: AuthMessageDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthMessageDto> {
    return this.authService.requestPasswordReset(dto.email, this.requestMeta(req));
  }

  @Post("reset-password")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Consume a password-reset token and set a new password" })
  @ApiResponse({ status: 200, type: AuthMessageDto })
  @ApiResponse({ status: 400, description: "Token invalid, expired, or already used" })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthMessageDto> {
    return this.authService.resetPassword(dto.token, dto.password, this.requestMeta(req));
  }

  private requestMeta(req: FastifyRequest): { ipAddress: string | null; userAgent: string | null } {
    return {
      ipAddress: req.ip ?? null,
      userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
    };
  }
}
