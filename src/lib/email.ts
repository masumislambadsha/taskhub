import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
): Promise<void> {
  const { error } = await resend.emails.send({
    // Use your verified domain in production, e.g. "TaskHub <noreply@yourdomain.com>"
    // For testing with Resend's sandbox, only the account owner's email can receive emails.
    from: "TaskHub <onboarding@resend.dev>",
    to: email,
    subject: "Reset your TaskHub password",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#FFF9E5;border-radius:12px;">
        <h1 style="font-size:24px;font-weight:800;color:#004030;margin:0 0 8px;">Reset your password</h1>
        <p style="color:rgba(0,64,48,0.75);font-size:15px;line-height:1.6;margin:0 0 32px;">
          We received a request to reset your TaskHub password. Click the button below to choose a new one.
          This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#004030;color:#fff;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;">
          Reset Password
        </a>
        <p style="color:rgba(0,64,48,0.5);font-size:13px;margin-top:32px;">
          If you didn't request this, you can safely ignore this email.
          Your password won't change until you click the link above.
        </p>
        <hr style="border:none;border-top:1px solid rgba(0,64,48,0.1);margin:32px 0 16px;" />
        <p style="color:rgba(0,64,48,0.4);font-size:12px;margin:0;">
          TaskHub · The premium micro-task marketplace
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[Resend] Failed to send password reset email:", error);
    throw new Error(error.message);
  }
}
