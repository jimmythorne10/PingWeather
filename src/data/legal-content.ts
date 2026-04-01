// Legal content for WeatherWatch
// Centralized, versioned EULA and Privacy Policy text.
// Adapted from SocialUplink (Truth Centered Tech)

export interface LegalSection {
  title: string;
  body: string;
}

export interface LegalDocument {
  version: string;
  effectiveDate: string;
  title: string;
  sections: LegalSection[];
}

// ────────────────────────────────────────────────────────────
// EULA (End User License Agreement / Terms of Use)
// ────────────────────────────────────────────────────────────
export const EULA_CONTENT: LegalDocument = {
  version: '1.0.0',
  effectiveDate: 'April 1, 2026',
  title: 'Terms of Use (EULA)',
  sections: [
    {
      title: 'Introduction',
      body: 'Welcome to WeatherWatch\u2122. These Terms of Use ("Agreement") are a legal agreement between you ("User") and Truth Centered Tech ("Company," "we," "us," or "our"). By using the WeatherWatch mobile application and related services (the "Service"), you agree to be bound by these terms. If you do not agree, do not use the Service.',
    },
    {
      title: 'License Grant',
      body: 'We grant you a limited, non-exclusive, non-transferable, revocable license to use the WeatherWatch application on your personal devices for your own personal or business use, subject to these terms. This license does not include the right to sublicense, modify, distribute, or create derivative works of the application. We reserve all rights not expressly granted to you.',
    },
    {
      title: 'Acceptable Use',
      body: 'You agree to use WeatherWatch only for lawful purposes and in accordance with these terms. You may not: (a) use the Service for any illegal purpose; (b) interfere with or disrupt the Service or its servers; (c) attempt to gain unauthorized access to any part of the Service; (d) use automated tools to access the Service except as provided by us; (e) reverse engineer, decompile, or disassemble any part of the Service; or (f) violate any applicable local, state, national, or international law.',
    },
    {
      title: 'Subscription Tiers',
      body: 'WeatherWatch offers multiple subscription tiers:\n\nFree Tier: Includes 1 monitored location, 2 alert rules, 12-hour minimum polling interval, 7-day alert history, and single-condition alerts.\n\nPro Tier ($3.99/month): Includes 3 monitored locations, 5 alert rules, 4-hour minimum polling interval, 30-day alert history, and compound condition alerts (AND/OR logic).\n\nPremium Tier ($7.99/month): Includes 10 monitored locations, unlimited alert rules, 1-hour minimum polling interval, 90-day alert history, compound condition alerts, and SMS alerts (when available).\n\nPricing and features are subject to change. We will notify you of any changes before your next billing cycle.',
    },
    {
      title: 'Weather Data Disclaimer',
      body: 'WeatherWatch provides weather forecasts and alerts based on data from third-party weather services. WEATHER FORECASTS ARE INHERENTLY UNCERTAIN AND SHOULD NOT BE RELIED UPON AS THE SOLE BASIS FOR DECISIONS AFFECTING LIFE, SAFETY, OR PROPERTY. We do not guarantee the accuracy, completeness, or timeliness of any weather data or alerts. You acknowledge that weather conditions can change rapidly and that forecast accuracy decreases with longer time horizons. WeatherWatch is a supplementary notification tool, not a replacement for official weather warnings from the National Weather Service or equivalent authorities in your jurisdiction.',
    },
    {
      title: 'Notification Delivery',
      body: 'While we make reasonable efforts to deliver notifications promptly, we do not guarantee that notifications will be delivered within any specific timeframe or at all. Notification delivery depends on factors outside our control, including your device settings, network connectivity, battery optimization settings, and push notification service availability. You are responsible for ensuring your device is configured to receive push notifications from WeatherWatch. We strongly recommend keeping official weather alert channels (NWS, emergency broadcasts) enabled as a backup.',
    },
    {
      title: 'Intellectual Property',
      body: 'The WeatherWatch application, including its design, code, logos, trademarks, and documentation, is owned by Truth Centered Tech and protected by intellectual property laws. "WeatherWatch" and the WeatherWatch logo are trademarks of the Company. You may not use our trademarks without prior written permission.',
    },
    {
      title: 'Limitation of Liability',
      body: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, TRUTH CENTERED TECH AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, LIVESTOCK, PROPERTY, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE OR RELIANCE ON WEATHER DATA OR NOTIFICATIONS PROVIDED BY THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER. Some jurisdictions do not allow the exclusion or limitation of certain damages, so some of the above limitations may not apply to you.',
    },
    {
      title: 'Indemnification',
      body: "You agree to indemnify, defend, and hold harmless Truth Centered Tech, its affiliates, officers, directors, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from: (a) your use of the Service; (b) your violation of these terms; (c) your reliance on weather data or notifications provided by the Service; or (d) any decisions you make based on information provided by the Service.",
    },
    {
      title: 'Termination',
      body: 'We may suspend or terminate your access to the Service at any time, with or without cause, with or without notice. You may terminate your account at any time by contacting us. Upon termination: (a) your license to use the Service ends immediately; (b) your alert configurations and history will be deleted within 30 days; and (c) your obligations under these terms survive termination where applicable.',
    },
    {
      title: 'Dispute Resolution',
      body: 'Any dispute arising from these terms or the Service shall first be attempted to be resolved through informal negotiation by contacting us at legal@truthcenteredtech.com. If the dispute cannot be resolved informally within 30 days, either party may submit the dispute to binding arbitration administered by the American Arbitration Association under its Consumer Arbitration Rules. The arbitration will be conducted in English. You agree that any dispute resolution proceedings will be conducted on an individual basis and not in a class, consolidated, or representative action. Small claims court actions are exempt from this arbitration requirement.',
    },
    {
      title: 'Governing Law',
      body: 'These terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law principles. You agree to submit to the personal jurisdiction of the courts located in Delaware for any actions not subject to arbitration.',
    },
    {
      title: 'Changes to These Terms',
      body: 'We may update these terms from time to time. We will notify you of material changes by posting the updated terms within the app and updating the version number and effective date. Your continued use of the Service after such changes constitutes acceptance of the new terms.',
    },
    {
      title: 'Contact Us',
      body: 'If you have questions about these Terms of Use, please contact us at:\n\nEmail: legal@truthcenteredtech.com\nWebsite: https://truthcenteredtech.com',
    },
  ],
};

// ────────────────────────────────────────────────────────────
// Privacy Policy
// ────────────────────────────────────────────────────────────
export const PRIVACY_POLICY_CONTENT: LegalDocument = {
  version: '1.0.0',
  effectiveDate: 'April 1, 2026',
  title: 'Privacy Policy',
  sections: [
    {
      title: 'Introduction',
      body: 'Truth Centered Tech ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the WeatherWatch mobile application and related services. Please read this policy carefully. If you do not agree with the terms of this Privacy Policy, please do not use the Service.',
    },
    {
      title: 'Data Collection',
      body: 'We collect information in the following ways:\n\nAccount Information: When you create an account, we collect your email address, display name, and authentication credentials.\n\nLocation Data: When you add monitored locations, we store the geographic coordinates (latitude and longitude) and names you provide. We do not continuously track your device location.\n\nAlert Configuration: We store your alert rules, conditions, polling intervals, and notification preferences to provide the Service.\n\nDevice Information: We collect your push notification token, device type, operating system version, and app version to deliver notifications and provide troubleshooting support.\n\nUsage Data: We collect basic usage statistics such as number of alerts triggered, features used, and error logs to improve the Service.',
    },
    {
      title: 'How We Use Your Data',
      body: 'We use the information we collect to:\n\n- Monitor weather conditions at your specified locations based on your alert rules.\n- Send push notifications when your alert conditions are met.\n- Maintain your alert history for the duration specified by your subscription tier.\n- Improve the Service, fix bugs, and develop new features.\n- Communicate with you about your account, billing, and service updates.\n\nWe do not use your data for advertising, marketing to third parties, or any purpose unrelated to providing the WeatherWatch Service.',
    },
    {
      title: 'Weather Data Sources',
      body: 'WeatherWatch retrieves forecast data from third-party weather APIs (currently Open-Meteo). Your location coordinates are sent to these services to retrieve local weather forecasts. These services receive only the coordinates, not your identity or account information. Please review the privacy policies of these services for information about how they handle location data.',
    },
    {
      title: 'Push Notification Services',
      body: 'We use Firebase Cloud Messaging (FCM) for Android and Apple Push Notification Service (APNs) for iOS to deliver notifications. Your device push token is stored on our servers and shared with these services solely for notification delivery. These services are operated by Google and Apple respectively and are subject to their privacy policies.',
    },
    {
      title: 'Data Retention',
      body: 'We retain your data as follows:\n\n- Account information: Retained until you delete your account.\n- Location data: Retained until you remove the location or delete your account.\n- Alert rules: Retained until you delete the rule or your account.\n- Alert history: Retained for the duration specified by your subscription tier (7 days Free, 30 days Pro, 90 days Premium), then automatically purged.\n- Usage data: Retained in aggregated, anonymized form indefinitely for service improvement.',
    },
    {
      title: 'Data Security',
      body: 'We implement industry-standard security measures to protect your data:\n\n- All data in transit is encrypted using TLS 1.2 or higher.\n- Authentication tokens are stored using native OS secure storage (Keychain on iOS, Keystore on Android).\n- Database access is controlled through Row Level Security (RLS) policies ensuring users can only access their own data.\n- We conduct regular security reviews of our infrastructure.\n- Despite our efforts, no method of electronic storage is 100% secure, and we cannot guarantee absolute security.',
    },
    {
      title: 'Analytics and Usage Data',
      body: 'We collect anonymized analytics data to improve the Service:\n\n- Feature usage statistics (e.g., most common alert types, average polling intervals).\n- Error rates and performance metrics.\n- We do not track individual user behavior across sessions beyond what is necessary for the Service to function.\n- Analytics data is aggregated and cannot be used to identify individual users.',
    },
    {
      title: "Children's Privacy (COPPA Compliance)",
      body: 'WeatherWatch is not intended for children under the age of 13 (or the applicable age of digital consent in your jurisdiction). We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at privacy@truthcenteredtech.com and we will promptly delete such information.',
    },
    {
      title: 'Your Rights Under GDPR (European Users)',
      body: 'If you are located in the European Economic Area (EEA) or United Kingdom, you have the following rights under the General Data Protection Regulation (GDPR):\n\n- Right of Access: You may request a copy of the personal data we hold about you.\n- Right to Rectification: You may request correction of inaccurate personal data.\n- Right to Erasure: You may request deletion of your personal data.\n- Right to Restrict Processing: You may request that we limit how we use your data.\n- Right to Data Portability: You may request your data in a structured, machine-readable format.\n- Right to Object: You may object to our processing of your personal data.\n- Right to Withdraw Consent: You may withdraw your consent at any time.\n\nTo exercise these rights, contact us at privacy@truthcenteredtech.com. We will respond within 30 days.',
    },
    {
      title: 'Your Rights Under CCPA (California Users)',
      body: 'If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with the following rights:\n\n- Right to Know: You may request disclosure of the categories and specific pieces of personal information we have collected about you.\n- Right to Delete: You may request deletion of your personal information.\n- Right to Opt-Out: You have the right to opt out of the sale of your personal information. Note: we do not sell your personal information.\n- Right to Non-Discrimination: We will not discriminate against you for exercising your CCPA rights.\n\nTo exercise these rights, contact us at privacy@truthcenteredtech.com.',
    },
    {
      title: 'Data Deletion Requests',
      body: 'You may request deletion of your account and all associated data at any time:\n\n- Contact us at privacy@truthcenteredtech.com with your account email.\n- We will process deletion requests within 30 days.\n- Upon deletion: your profile, locations, alert rules, alert history, and device tokens will be permanently removed.\n- We may retain anonymized, aggregated data that cannot identify you for statistical purposes.',
    },
    {
      title: 'International Data Transfers',
      body: 'WeatherWatch processes data using servers located in the United States. If you are located outside the United States, your data may be transferred to and processed in the United States.\n\nWe ensure appropriate safeguards for international transfers through: (a) Standard Contractual Clauses approved by the European Commission; (b) compliance with applicable data protection frameworks; and (c) contractual obligations with our infrastructure providers that require them to protect your data.',
    },
    {
      title: 'Changes to This Privacy Policy',
      body: 'We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy within the app and updating the version number and effective date. Your continued use of the Service after such changes constitutes acceptance of the updated policy.',
    },
    {
      title: 'Contact Information',
      body: 'If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:\n\nEmail: privacy@truthcenteredtech.com\nLegal Inquiries: legal@truthcenteredtech.com\nWebsite: https://truthcenteredtech.com\n\nData Protection Officer: privacy@truthcenteredtech.com',
    },
  ],
};
