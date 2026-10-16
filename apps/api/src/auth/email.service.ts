
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);
    private readonly transporter?: Transporter;

    constructor(private readonly config: ConfigService) {
        if (this.config.get('NODE_ENV') !== 'production') {
            this.logger.warn(
                'DEV EMAIL MODE: коды выводятся в консоль',
            );
            return;
        }

        const port = Number(
            this.config.getOrThrow<string>('SMTP_PORT'),
        );

        this.transporter = nodemailer.createTransport({
            host: this.config.getOrThrow<string>('SMTP_HOST'),
            port,
            secure: port === 465,
            auth: {
                user: this.config.getOrThrow<string>('SMTP_USER'),
                pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
            },
        });
    }

    async sendAuthCode(email: string, code: string) {
        if (this.config.get('NODE_ENV') !== 'production') {
            this.logger.log(
                `\n[DEV EMAIL]\nTo: ${email}\nCode: ${code}\n`,
            );
            return;
        }

        if (!this.transporter) {
            throw new Error('SMTP transporter is not configured');
        }

        await this.transporter.sendMail({
            from: this.config.getOrThrow<string>('SMTP_FROM'),
            to: email,
            subject: 'Код подтверждения — ЗалогХаб',
            text:
                `Ваш код подтверждения: ${code}\n` +
                'Код действует 10 минут.',
        });
    }
}
