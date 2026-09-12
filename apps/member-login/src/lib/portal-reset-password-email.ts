import { createPortalActivationEmail, type ActivationEmail } from "./portal-activation-email.ts";

export type ResetPasswordEmail = ActivationEmail;

/** Reuses the approved activation design while giving reset mail its own copy. */
export function createPortalResetPasswordEmail(input: {
  recipient: string;
  displayName: string;
  resetUrl: string;
}): ResetPasswordEmail {
  const activationEmail = createPortalActivationEmail({
    recipient: input.recipient,
    displayName: input.displayName,
    activationUrl: input.resetUrl,
  });

  const resetNotice = `<div class="password-reset-notice" style="margin:0;padding:0 0 12px;text-align:left;color:#757575"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%"><tr><td style="padding:0 0 16px;text-align:center"><img src="https://images.wixstatic.com/media/b49ee3_4a3326c44974463e8e1c99383219bf93~mv2.png/v1/fit/al_c,h_7,q_100,w_700,br_-100,sat_-100,hue_180/b49ee3_4a3326c44974463e8e1c99383219bf93~mv2.png" width="504" height="7" alt="" style="display:inline-block;max-width:100%;height:auto"></td></tr></table><h2 class="password-reset-notice-title" style="margin:0;text-align:center;font-family:'Fjalla One',Tahoma,sans-serif;font-size:16px;line-height:9px;font-weight:700;color:#000">Important Notice About Your Password Reset Link</h2><p style="margin:0;text-align:center;line-height:17px;font-size:34px">&nbsp;</p><div style="padding:0 20px"><p style="margin:0 0 5px;text-align:left;font-family:'Fjalla One',Tahoma,sans-serif;font-size:15px;line-height:17px;color:#000">Link Expiration (Valid for 15 Minutes, One-Time Use)</p><p style="margin:0;text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:17px;color:#757575">For security reasons, the link provided is active for only 15 minutes and can be used just once.</p><p style="margin:0;text-align:left;line-height:17px;font-size:34px">&nbsp;</p><p style="margin:0 0 5px;text-align:left;font-family:'Fjalla One',Tahoma,sans-serif;font-size:15px;line-height:17px;color:#000">Need a Replacement Link?</p><p style="margin:0;text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:17px;color:#757575">If the link expires before you finish resetting your password, simply click &quot;Forgot Password&quot; on the login page to request a new one.</p><p style="margin:0;text-align:left;line-height:17px;font-size:34px">&nbsp;</p><p style="margin:0 0 5px;text-align:left;font-family:'Fjalla One',Tahoma,sans-serif;font-size:15px;line-height:17px;color:#000">Need Help?</p><p style="margin:0;text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:17px;color:#757575">You can reach out to us at support@gymfusion.com.au, and we&rsquo;ll send you a new link. Please keep in mind that manual support may take time, so using the &quot;Forgot Password&quot; option is the quickest way to regain access.</p><div style="margin:0 -20px;padding:12px 0;text-align:center"><img src="https://images.wixstatic.com/media/b49ee3_4a3326c44974463e8e1c99383219bf93~mv2.png/v1/fit/al_c,h_7,q_100,w_700,br_-100,sat_-100,hue_180/b49ee3_4a3326c44974463e8e1c99383219bf93~mv2.png" width="504" height="7" alt="" style="display:inline-block;max-width:100%;height:auto"></div><p style="margin:20px 0 0;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#757575">If you did not initiate this request or request a password reset, please disregard this email. No further action is necessary, and your account will remain unaffected.</p><p style="margin:0;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#757575">&nbsp;</p><p style="margin:0 0 20px;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#757575">If you have received this message but do not recall expressing interest in joining GYMFUSION Fitness Shepparton, please contact us at support@gymfusion.com.au to report the error, and we will promptly address the matter.</p></div></div>`;

  return {
    to: activationEmail.to,
    subject: "Reset your GYMFUSION password",
    html: activationEmail.html
      .replace(/\s*<p class="email-copy"[^>]*>We&rsquo;re thrilled you&rsquo;re considering joining GYMFUSION!&nbsp;<\/p>/, "")
      .replace("We&rsquo;re excited to have you move forward with your Expression of Interest! Head over to the GYMFUSION Member Portal to finish up a few small tasks and upload any documents we may need to review.", "A request has been received (initiated by you or an administrator) to reset your GYMFUSION Portal password.")
      .replace("Create your password to get started!", "Reset your GYMFUSION password")
      .replace("Ready to get started? Just click the button below to create your password!", "To reset your password, click the button below:")
      .replace(/<p style="margin:0 20px 0;padding-top:4px;padding-bottom:12px;text-align:center;font-size:13px;line-height:19px;color:#555">If you didn&rsquo;t submit an EOI,[\s\S]*?<\/p><p style="margin:0 20px 0;padding-bottom:12px;text-align:center;font-size:13px;line-height:19px;color:#555">For security reasons,[\s\S]*?<\/p>/, resetNotice)
      .replace(">Create Password</a>", ">Reset Password</a>"),
  };
}
