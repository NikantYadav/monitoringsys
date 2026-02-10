const nodemailer = require('nodemailer');

class EmailNotifier {
    constructor() {
        this.transporter = null;
        this.enabled = false;
        this.config = {
            from: process.env.EMAIL_FROM || 'monitoring@example.com',
            fromName: process.env.EMAIL_FROM_NAME || 'System Monitor',
            adminEmails: process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : []
        };
        
        this.initialize();
    }

    initialize() {
        try {
            // Check if email configuration exists
            if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
                console.log('Email notifications disabled - SMTP configuration not found');
                console.log('   Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env to enable');
                return;
            }

            // Create transporter
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
                }
            });

            this.enabled = true;
            console.log('✓ Email notifications enabled');
            
            // Verify connection
            this.verifyConnection();
        } catch (error) {
            console.error('✗ Email notifier initialization failed:', error.message);
            this.enabled = false;
        }
    }

    async verifyConnection() {
        if (!this.enabled) return;

        try {
            await this.transporter.verify();
            console.log('✓ SMTP connection verified');
        } catch (error) {
            console.error('✗ SMTP connection failed:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Send alert notification email
     */
    async sendAlertNotification(alert, vmInfo = {}) {
        if (!this.enabled) {
            console.log('Email notifications disabled, skipping...');
            return { success: false, reason: 'disabled' };
        }

        if (this.config.adminEmails.length === 0) {
            console.log('No admin emails configured, skipping...');
            return { success: false, reason: 'no_recipients' };
        }

        try {
            const subject = this.buildSubject(alert);
            const html = this.buildAlertEmail(alert, vmInfo);
            const text = this.buildAlertEmailText(alert, vmInfo);

            const mailOptions = {
                from: `"${this.config.fromName}" <${this.config.from}>`,
                to: this.config.adminEmails.join(', '),
                subject: subject,
                text: text,
                html: html
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✓ Alert email sent: ${info.messageId}`);
            
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('✗ Failed to send alert email:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Build email subject
     */
    buildSubject(alert) {
        const level = alert.severity.toUpperCase();
        const metric = this.getMetricLabel(alert.metric_type);
        
        return `[${level}] ${metric} - ${alert.hostname}`;
    }

    /**
     * Build HTML email for alert
     */
    buildAlertEmail(alert, vmInfo) {
        const severityColor = alert.severity === 'critical' ? '#f7768e' : '#ffc107';
        
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${severityColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
        .alert-box { background: white; padding: 15px; border-left: 4px solid ${severityColor}; margin: 15px 0; border-radius: 4px; }
        .metric { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .metric:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #666; }
        .value { color: #333; }
        .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background: #7aa2f7; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${alert.severity.toUpperCase()} Alert</h1>
        </div>
        <div class="content">
            <div class="alert-box">
                <h2 style="margin-top: 0; color: ${severityColor};">${this.getMetricLabel(alert.metric_type)}</h2>
                <p style="font-size: 16px; margin: 10px 0;">${alert.message}</p>
            </div>
            
            <div style="background: white; padding: 15px; border-radius: 4px; margin: 15px 0;">
                <h3 style="margin-top: 0;">Alert Details</h3>
                <div class="metric">
                    <span class="label">VM / Hostname:</span>
                    <span class="value">${alert.hostname}</span>
                </div>
                <div class="metric">
                    <span class="label">VM ID:</span>
                    <span class="value">${alert.vm_id}</span>
                </div>
                <div class="metric">
                    <span class="label">Metric:</span>
                    <span class="value">${this.getMetricLabel(alert.metric_type)}</span>
                </div>
                <div class="metric">
                    <span class="label">Severity:</span>
                    <span class="value" style="color: ${severityColor}; font-weight: bold;">${alert.severity.toUpperCase()}</span>
                </div>
                <div class="metric">
                    <span class="label">Threshold:</span>
                    <span class="value">${alert.threshold_value}</span>
                </div>
                <div class="metric">
                    <span class="label">Current Value:</span>
                    <span class="value" style="color: ${severityColor}; font-weight: bold;">${alert.current_value}</span>
                </div>
                <div class="metric">
                    <span class="label">Triggered At:</span>
                    <span class="value">${new Date(alert.triggered_at).toLocaleString()}</span>
                </div>
            </div>

            <div style="text-align: center; margin: 20px 0;">
                <a href="${this.getDashboardUrl()}/vm/${alert.vm_id}" class="button">View Dashboard</a>
                <a href="${this.getDashboardUrl()}/vm/${alert.vm_id}?tab=alerts" class="button">View Alerts</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated alert from your System Monitor</p>
            <p>Dashboard: <a href="${this.getDashboardUrl()}">${this.getDashboardUrl()}</a></p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Build plain text email for alert
     */
    buildAlertEmailText(alert, vmInfo) {
        const level = alert.severity.toUpperCase();
        
        return `
[${level}] ALERT

${this.getMetricLabel(alert.metric_type)}

${alert.message}

ALERT DETAILS:
--------------
VM / Hostname: ${alert.hostname}
VM ID: ${alert.vm_id}
Metric: ${this.getMetricLabel(alert.metric_type)}
Severity: ${alert.severity.toUpperCase()}
Threshold: ${alert.threshold_value}
Current Value: ${alert.current_value}
Triggered At: ${new Date(alert.triggered_at).toLocaleString()}

View Dashboard: ${this.getDashboardUrl()}/vm/${alert.vm_id}
View Alerts: ${this.getDashboardUrl()}/vm/${alert.vm_id}?tab=alerts

---
This is an automated alert from your System Monitor
Dashboard: ${this.getDashboardUrl()}
        `;
    }

    /**
     * Get metric label
     */
    getMetricLabel(metricType) {
        const labels = {
            'cpu_usage': 'CPU Usage',
            'load_average': 'Load Average',
            'memory_usage': 'Memory Usage',
            'swap_usage': 'Swap Usage',
            'disk_usage': 'Disk Usage',
            'disk_inodes': 'Disk Inodes',
            'disk_io_wait': 'Disk I/O Wait'
        };
        
        if (metricType.startsWith('service_')) {
            const serviceName = metricType.replace('service_', '');
            return `Service: ${serviceName}`;
        }
        
        return labels[metricType] || metricType;
    }

    /**
     * Get dashboard URL
     */
    getDashboardUrl() {
        return process.env.DASHBOARD_URL || 'http://localhost:5173';
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('Email notifier configuration updated');
    }

    /**
     * Get current configuration (without sensitive data)
     */
    getConfig() {
        return {
            enabled: this.enabled,
            from: this.config.from,
            fromName: this.config.fromName,
            adminEmails: this.config.adminEmails,
            smtpConfigured: !!process.env.SMTP_HOST
        };
    }
}

module.exports = new EmailNotifier();
