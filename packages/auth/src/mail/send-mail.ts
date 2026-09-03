import { backendEnv } from "@webcampus/common/env";
import nodemailer from "nodemailer";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: backendEnv().SENDER_EMAIL,
        pass: backendEnv().GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export const sendEmail = async ({ to, subject, html }: SendEmailParams) => {
  const response = await getTransporter().sendMail({
    from: backendEnv().SENDER_EMAIL,
    to,
    subject,
    html,
  });
  return response;
};
