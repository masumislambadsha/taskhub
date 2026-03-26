import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
): Promise<void> {
  const { error } = await resend.emails.send({
    
    
    from: "TaskHub <onboarding@resend.dev>",
    to: email,
    subject: "Reset your TaskHub password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @media (prefers-color-scheme: dark) {
              .body { background-color: #00221a !important; color: #ffffff !important; }
              .container { background-color: #003326 !important; border-color: #004d3a !important; }
              .title { color: #4a9782 !important; }
              .text { color: rgba(255,255,255,0.7) !important; }
              .footer { background-color: #00221a !important; color: rgba(255,255,255,0.4) !important; }
              .button { background-color: #4a9782 !important; color: #ffffff !important; }
            }
          </style>
        </head>
        <body className="body" style="margin:0;padding:0;background-color:#FFF9E5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" style="padding:40px 20px;">
                <table className="container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:500px;background-color:#ffffff;border-radius:24px;border:1px solid rgba(0,64,48,0.05);overflow:hidden;box-shadow:0 10px 30px -10px rgba(0,64,48,0.15);">
                  <tr>
                    <td style="padding:48px 40px;">
                      <h1 className="title" style="margin:0 0 12px;font-size:26px;font-weight:800;color:#004030;letter-spacing:-0.03em;">Reset your password</h1>
                      <p className="text" style="margin:0 0 32px;font-size:16px;line-height:1.6;color:rgba(0,64,48,0.7);">
                        We received a request to reset your TaskHub password. Click the button below to choose a new one. This link will expire in 1 hour.
                      </p>
                      <a href="${resetUrl}" className="button" style="display:inline-block;padding:16px 36px;background-color:#004030;color:#ffffff;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:0.01em;">
                        Reset Password
                      </a>
                      <p className="text" style="margin:36px 0 0;font-size:14px;color:rgba(0,64,48,0.5);line-height:1.6;">
                        If you didn't request this, you can safely ignore this email. Your password won't change until you click the link above.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td className="footer" style="padding:24px 40px;background-color:#004030;text-align:center;font-size:12px;color:rgba(255,255,255,0.4);font-weight:500;">
                      TaskHub · The premium micro-task marketplace
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  });

  if (error) {
    console.error("[Resend] Failed to send password reset email:", error);
    throw new Error(error.message);
  }
}
