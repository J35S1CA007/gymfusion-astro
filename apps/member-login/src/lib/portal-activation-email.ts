export type ActivationEmail = {
  to: string;
  subject: string;
  html: string;
};

export function createPortalActivationEmail(input: {
  recipient: string;
  displayName: string;
  activationUrl: string;
}): ActivationEmail {
  const hasDisplayName = input.displayName.trim().length > 0;
  const displayName = escapeHtml(hasDisplayName ? input.displayName.trim() : "there");
  const greeting = hasDisplayName
    ? `Hey ${displayName},`
    : `Hey ${displayName} <img class="wave-emoji" src="https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@main/emojis/waving%20hand%20gif.gif" alt="Waving hand" width="32" height="32" style="display:inline-block;width:32px;height:32px;vertical-align:-0.35em;position:relative;top:-7px">`;
  const activationUrl = escapeAttribute(input.activationUrl);

  const email = {
    to: input.recipient,
    subject: "Create your password to get started!",
    html: `<!doctype html><style>.password-reset-notice{margin-left:0!important;margin-right:0!important}.password-reset-notice-title{line-height:22px!important}@media only screen and (max-width:480px){.password-reset-notice{margin-left:0!important;margin-right:0!important}.password-reset-notice-title{font-size:15px!important;line-height:20px!important}}</style><style>@media only screen and (max-width:480px){.email-card{margin-top:7px!important}.top-spacer{height:57px!important;line-height:57px!important}.email-button{width:176px!important;box-sizing:border-box!important}.follow-section{padding:20px 12px!important}.follow-title{font-size:18px!important;margin-bottom:24px!important}.follow-section a{margin:0 12px!important}.follow-section img{width:36px!important;height:36px!important}}</style>
<html lang="en"><head><style>@import url('https://fonts.googleapis.com/css2?family=Fjalla+One&display=swap');.email-background{position:relative;overflow:hidden;background:#440273}.email-background::before{content:"";position:absolute;inset:0;background:#440273 url('https://static.wixstatic.com/media/f190ff_fd9352f6d11b461d958b579953124753~mv2.png') repeat;transform:scale(-1,-1);transform-origin:center;z-index:0}.email-outer{position:relative;z-index:1;background:transparent!important}.mobile-logo{display:none!important}@media only screen and (max-width:480px){.email-outer{width:100%!important;padding:16px!important}.email-card{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important}.top-spacer{height:0!important;line-height:0!important}.email-content{padding:20px!important;overflow-wrap:anywhere!important}.email-footer{padding:18px 20px 28px!important}.logo-cell{padding:24px 28px 0!important}.email-logo{max-height:90px!important}.desktop-logo{display:none!important}.mobile-logo{display:inline-block!important}.email-title{font-size:24px!important;line-height:31px!important}.wave-emoji{width:24px!important;height:24px!important}.email-copy{font-size:14px!important;line-height:21px!important}.email-button{display:inline-block!important;width:auto!important}}</style></head><body style="margin:0;background:#440273;color:#222;font-family:Helvetica,Arial,sans-serif">
  <div class="email-background" style="background-color:#000;background-image:url('https://static.wixstatic.com/media/f190ff_fd9352f6d11b461d958b579953124753~mv2.png');background-repeat:repeat;background-position:center;background-size:auto">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-outer" background="https://static.wixstatic.com/media/f190ff_fd9352f6d11b461d958b579953124753~mv2.png" style="background-color:#000;background-image:url('https://static.wixstatic.com/media/f190ff_fd9352f6d11b461d958b579953124753~mv2.png');background-repeat:repeat;background-position:center;padding:16px">
    <style>@media only screen and (max-width:480px){.email-card{margin-top:7px!important}.top-spacer{height:24px!important;line-height:24px!important}.email-logo{margin-bottom:15px!important}.email-content{padding-bottom:0!important}.email-copy:last-of-type{margin-bottom:18px!important}.email-button{width:176px!important;box-sizing:border-box!important}.follow-section{padding:20px 12px!important}.follow-title{font-size:18px!important;margin-bottom:24px!important}.follow-section a{margin:0 12px!important}.follow-section img{width:36px!important;height:36px!important}}</style>
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" class="email-card" style="max-width:600px;width:100%;margin-top:32px;background:#fff">
        <tr><td class="top-spacer" style="height:40px;line-height:40px;background:#fff;font-size:0">&nbsp;</td></tr>
        <tr><td class="logo-cell" style="padding:24px 0 0;text-align:center;background:#fff;color:#000">
          <img class="email-logo desktop-logo" src="https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@main/logo/vibrant_full_logo_and_heading_black_slogan_transparent.png" alt="GYMFUSION" width="600" style="display:inline-block;max-width:100%;width:auto;vertical-align:middle;max-height:140px;margin:0 auto 24px">
          <img class="email-logo mobile-logo" src="https://images.wixstatic.com/media/f190ff_7d45ee7fc84142cab411beffedce1434~mv2.png/v1/fit/h_180,q_100,w_504,al_c,lg_0/f190ff_7d45ee7fc84142cab411beffedce1434~mv2.png" alt="GYMFUSION" width="504" style="display:none;max-width:100%;width:auto;vertical-align:middle;max-height:90px;margin:0 auto 24px">
        </td></tr>
        <tr><td class="email-content" style="padding:20px 20px 0;text-align:center">
          <h1 class="email-title" style="margin:0 0 36px;font-family:'Fjalla One',Tahoma,sans-serif;font-size:30px;line-height:39px;letter-spacing:-.05em;font-weight:400;color:#000">${greeting}&nbsp;</h1>
          <p class="email-copy" style="margin:0 0 24px;font-family:'Fjalla One',Tahoma,sans-serif;font-size:17px;line-height:25px;font-style:italic;font-weight:700;color:#000">We&rsquo;re thrilled you&rsquo;re considering joining GYMFUSION!&nbsp;</p>
          <p class="email-copy" style="margin:0 0 24px;font-size:16px;line-height:24px;color:#000">We&rsquo;re excited to have you move forward with your Expression of Interest! Head over to the GYMFUSION Member Portal to finish up a few small tasks and upload any documents we may need to review.</p>
          <p class="email-copy" style="margin:0 0 24px;font-family:'Fjalla One',Tahoma,sans-serif;font-size:16px;line-height:24px;color:#222">Ready to get started? Just click the button below to create your password!</p>
          <p class="email-button-wrap" style="margin:0;padding:2px 20px 14px;position:relative;top:-3px"><a class="email-button" href="${activationUrl}" style="display:inline-block;width:176px;box-sizing:border-box;padding:15px 36px;border-radius:17px;background:#000;color:#fff;text-decoration:none;font-family:'Fjalla One',Tahoma,sans-serif;font-size:16px;font-weight:400;line-height:120%;white-space:nowrap">Create Password</a></p>
          <p style="margin:0 20px 0;padding-top:4px;padding-bottom:12px;text-align:center;font-size:13px;line-height:19px;color:#555">If you didn&rsquo;t submit an EOI, you can safely ignore this email.</p><p style="margin:0 20px 0;padding-bottom:12px;text-align:center;font-size:13px;line-height:19px;color:#555">For security reasons, the button containing the secure link is valid for 15 minutes and can only be used once. If the link expires, please visit the <a href="http://www.portal.gymfusion.com.au/login" style="color:#555;text-decoration:underline">Login page</a>, click the &quot;Help&quot; button, then select the &quot;Create a Password!&quot; option, and enter your email address to receive a new secure link.</p>
        </td></tr>
        <tr><td style="padding:0 20px;text-align:center"><img src="https://images.wixstatic.com/media/b49ee3_4a3326c44974463e8e1c99383219bf93~mv2.png/v1/fit/al_c,h_7,q_100,w_700,br_-100,sat_-100,hue_180/b49ee3_4a3326c44974463e8e1c99383219bf93~mv2.png" width="504" height="7" alt="" style="display:inline-block;max-width:100%;height:auto"></td></tr>
        <tr><td class="follow-section" valign="middle" style="padding:24px 20px;text-align:center;vertical-align:middle;background:#fff;color:#000">
          <p class="follow-title" style="margin:0 0 24px;text-align:center;font-family:'Fjalla One',Tahoma,sans-serif;font-size:20px;line-height:1;font-weight:700;color:#000">Follow Us</p>
          <a href="https://www.facebook.com/people/GymFusion-Fitness-Studio/61577864369134/" style="display:inline-block;margin:0 13px"><img src="https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@main/social%20media%20icons/facebook_icon.png" width="32" height="32" alt="Follow on Facebook" style="display:block;width:32px;height:32px;border:0;border-radius:3px"></a>
          <a href="https://www.instagram.com/gymfusion_shepparton" style="display:inline-block;margin:0 13px"><img src="https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@main/social%20media%20icons/instagram_icon.png" width="32" height="32" alt="Follow on Instagram" style="display:block;width:32px;height:32px;border:0;border-radius:3px"></a>
        </td></tr>
        <tr><td style="padding:0 20px;text-align:center;position:relative;top:-8px"><img src="https://images.wixstatic.com/media/b49ee3_4a3326c44974463e8e1c99383219bf93~mv2.png/v1/fit/al_c,h_7,q_100,w_700,br_-100,sat_-100,hue_180/b49ee3_4a3326c44974463e8e1c99383219bf93~mv2.png" width="504" height="7" alt="" style="display:inline-block;max-width:100%;height:auto"></td></tr>
        <tr><td class="email-footer" style="padding:20px 40px 40px;text-align:center;font-size:12px;line-height:20px;color:#555"><div style="text-align:center"><img src="https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@main/logo/vibrant_spiral_transparent.png" alt="GYMFUSION spiral logo" width="28" height="28" style="display:block;width:28px;height:28px;margin:0 auto 8px"><strong>GYMFUSION</strong><br><strong>ABN</strong>&nbsp;97 143 803 038<br>70 New Dookie Rd, Shepparton, VIC, 3629<br>support@gymfusion.com.au</div></td></tr>
      </table>
    </td></tr>
  </table>
  </div>
</body></html>`,
  };
  email.html = email.html.replaceAll("#440273", "#000000");
  return email;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

