import { Resend } from "resend";
import logger from "./logger";

const getClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not configured. Emails will be skipped.");
    return null;
  }
  return new Resend(apiKey);
};

const FROM = (): string =>
  process.env.EMAIL_FROM || "Prapti Foundation <no-reply@yourdomain.com>";

const ORG = (): string => process.env.ORG_NAME || "Prapti Foundation";

const footerHtml = (): string => `
  <tr>
    <td style="background:#f4f4f7;padding:16px 24px;text-align:center;">
      <p style="font-size:12px;color:#aaa;margin:0;">
        &copy; ${new Date().getFullYear()} ${ORG()}. All rights reserved.
      </p>
    </td>
  </tr>
`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface VolunteerApprovalPayload {
  to: string;
  firstName: string;
  volunteerId: string;
}

interface VolunteerRejectionPayload {
  to: string;
  firstName: string;
  volunteerId: string;
  reason?: string;
}

// ─── HTML Builders ───────────────────────────────────────────────────────────

const buildApprovalHtml = (payload: VolunteerApprovalPayload): string => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:#2e7d32;padding:32px 24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">Application Approved!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 24px;">
          <p style="font-size:16px;color:#333;margin:0 0 16px;">
            Dear <strong>${payload.firstName}</strong>,
          </p>
          <p style="font-size:15px;color:#555;margin:0 0 24px;">
            We are delighted to inform you that your volunteer application to
            <strong>${ORG()}</strong> has been <strong style="color:#2e7d32;">approved</strong>.
          </p>
          <p style="font-size:15px;color:#555;margin:0 0 24px;">
            Our team will reach out to you shortly with onboarding details and next steps.
            We look forward to working with you!
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #e5e5e5;margin-bottom:24px;">
            <tr>
              <td style="padding:8px 12px;font-weight:600;color:#555;">Reference ID</td>
              <td style="padding:8px 12px;font-family:monospace;font-size:15px;">${payload.volunteerId}</td>
            </tr>
          </table>
          <p style="font-size:13px;color:#999;margin:0;">
            This is an auto-generated email. Please do not reply to this message.
          </p>
        </td>
      </tr>
      ${footerHtml()}
    </table>
  </body>
  </html>
`;

const buildRejectionHtml = (payload: VolunteerRejectionPayload): string => {
  const reasonRow = payload.reason
    ? `<tr>
        <td style="padding:8px 12px;font-weight:600;color:#555;">Reason</td>
        <td style="padding:8px 12px;">${payload.reason}</td>
       </tr>`
    : "";

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f7;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:#5a5a5a;padding:32px 24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">Application Update</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 24px;">
          <p style="font-size:16px;color:#333;margin:0 0 16px;">
            Dear <strong>${payload.firstName}</strong>,
          </p>
          <p style="font-size:15px;color:#555;margin:0 0 24px;">
            Thank you for your interest in volunteering with <strong>${ORG()}</strong>.
            After careful review, we are unable to approve your application at this time.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;border:1px solid #e5e5e5;margin-bottom:24px;">
            <tr>
              <td style="padding:8px 12px;font-weight:600;color:#555;">Reference ID</td>
              <td style="padding:8px 12px;font-family:monospace;font-size:15px;">${payload.volunteerId}</td>
            </tr>
            ${reasonRow}
          </table>
          <p style="font-size:15px;color:#555;margin:0 0 24px;">
            We appreciate your willingness to contribute and encourage you to apply again in the future.
          </p>
          <p style="font-size:13px;color:#999;margin:0;">
            This is an auto-generated email. Please do not reply to this message.
          </p>
        </td>
      </tr>
      ${footerHtml()}
    </table>
  </body>
  </html>
  `;
};

// ─── Send Functions ──────────────────────────────────────────────────────────

export const sendVolunteerApprovalEmail = async (
  payload: VolunteerApprovalPayload,
): Promise<boolean> => {
  const resend = getClient();
  if (!resend) return false;

  try {
    const { error } = await resend.emails.send({
      from: FROM(),
      to: payload.to,
      subject: `Congratulations! Your Volunteer Application is Approved — ${ORG()}`,
      html: buildApprovalHtml(payload),
    });

    if (error) {
      logger.error(`Resend approval error for ${payload.to}:`, error);
      return false;
    }

    logger.info(`Volunteer approval email sent to ${payload.to}`);
    return true;
  } catch (err) {
    logger.error(`Failed to send approval email to ${payload.to}:`, err);
    return false;
  }
};

export const sendVolunteerRejectionEmail = async (
  payload: VolunteerRejectionPayload,
): Promise<boolean> => {
  const resend = getClient();
  if (!resend) return false;

  try {
    const { error } = await resend.emails.send({
      from: FROM(),
      to: payload.to,
      subject: `Update on Your Volunteer Application — ${ORG()}`,
      html: buildRejectionHtml(payload),
    });

    if (error) {
      logger.error(`Resend rejection error for ${payload.to}:`, error);
      return false;
    }

    logger.info(`Volunteer rejection email sent to ${payload.to}`);
    return true;
  } catch (err) {
    logger.error(`Failed to send rejection email to ${payload.to}:`, err);
    return false;
  }
};
