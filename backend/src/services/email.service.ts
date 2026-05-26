import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private fromEmail: string;

    constructor() {
        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        this.fromEmail = process.env.EMAIL_FROM || user || 'noreply@scripteditor.com';

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port: Number(port) || 587,
                secure: Number(port) === 465, // true for 465, false for other ports
                auth: { user, pass },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 10000,
            });
            console.log(`[EmailService] SMTP configured: ${host}:${port || 587}`);
        } else {
            console.warn('[EmailService] SMTP not configured. Emails will be logged to console.');
        }
    }

    private async sendEmail(to: string, subject: string, _html: string): Promise<void> {
        if (!this.transporter) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`[Email Mock] To: ${to} | Subject: ${subject}`);
            }
            return;
        }

        try {
            await this.transporter.sendMail({
                from: `AI Script Editor <${this.fromEmail}>`,
                to,
                subject,
                html: _html,
            });
        } catch (error) {
            console.error('Failed to send email:', error);
            throw error;
        }
    }

    public async sendVerificationEmail(to: string, code: string): Promise<void> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #18181b;">
                <h2>Welcome to AI Script Editor!</h2>
                <p>Please verify your email address using the code below:</p>
                <div style="background-color: #f4f4f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <h1 style="letter-spacing: 4px; margin: 0; color: #18181b;">${code}</h1>
                </div>
                <p>This code will expire in 15 minutes.</p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
            </div>
        `;
        await this.sendEmail(to, 'Verify your AI Script Editor account', html);
    }

    public async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #18181b;">
                <h2>Reset Your Password</h2>
                <p>We received a request to reset your AI Script Editor password.</p>
                <p>Click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" style="background-color: #09090b; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
                </div>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
        `;
        await this.sendEmail(to, 'Reset your AI Script Editor password', html);
    }

    public async sendWelcomeEmail(to: string, name: string): Promise<void> {
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #18181b;">
                <h2>Welcome aboard, ${name}! 🚀</h2>
                <p>We're thrilled to have you join AI Script Editor.</p>
                <p>Our goal is to provide a premium, collaborative workspace to compile Hollywood-standard screenplays with real-time AI assistance.</p>
                <p>Head over to your workspace dashboard to start your first project!</p>
            </div>
        `;
        await this.sendEmail(to, 'Welcome to AI Script Editor!', html);
    }
}

export const emailService = new EmailService();
