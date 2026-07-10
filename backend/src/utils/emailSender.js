const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

async function sendEmailOTP(toEmail, otpCode, purpose = "Verification") {
  if (!toEmail) return;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
      <h2 style="color: #333;">Classic Chinese</h2>
      <p style="font-size: 16px; color: #555;">Here is your ${purpose} code:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #e11d48; margin: 20px 0; padding: 15px; background: #fff1f2; border-radius: 8px;">
        ${otpCode}
      </div>
      <p style="font-size: 14px; color: #888;">This code will expire in 2 minutes. Do not share it with anyone.</p>
    </div>
  `;

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
    await resend.emails.send({
      from: `Classic Chinese <${fromEmail}>`,
      to: toEmail,
      subject: `${purpose} Code - Classic Chinese`,
      html: htmlContent
    });
    
    console.log(`Email OTP sent to ${toEmail}`);
  } catch (error) {
    console.error("Failed to send Email OTP:", error);
  }
}

module.exports = { sendEmailOTP };
