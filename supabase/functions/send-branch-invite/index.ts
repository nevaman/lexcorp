import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type InvitePayload = {
  email?: string;
  inviteLink?: string;
  branchIdentifier?: string;
  organizationName?: string;
  subject?: string;
  description?: string;
  roleLabel?: string;
};

const getEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const smtpConfig = {
  hostname: getEnv('SMTP_HOST'),
  port: Number(Deno.env.get('SMTP_PORT') ?? 465),
  username: getEnv('SMTP_USER'),
  password: getEnv('SMTP_PASS'),
  from: getEnv('SMTP_SENDER'),
};

const buildEmailHtml = (payload: InvitePayload) => {
  const { organizationName, branchIdentifier, inviteLink, description, roleLabel } = payload;
  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; color: #0f172a;">
      <h2 style="font-size: 20px; margin-bottom: 8px;">You're invited to ${organizationName}</h2>
      <p style="margin: 0 0 16px;">
        You've been designated as the branch administrator for <strong>${branchIdentifier}</strong>.
      </p>
      <p style="margin: 0 0 16px;">
        ${
          description ||
          'Click the button below to activate your account, set a password, and access your branch workspace.'
        }
      </p>
      <p style="margin: 24px 0;">
        <a
          href="${inviteLink}"
          style="background: #f97316; color: white; padding: 12px 20px; border-radius: 999px; text-decoration: none; font-weight: 600;"
        >
          ${roleLabel || 'Activate Account'}
        </a>
      </p>
      <p style="font-size: 12px; color: #475569;">
        If the button doesn't work, copy and paste this URL into your browser:
        <br/>
        <span style="word-break: break-all;">${inviteLink}</span>
      </p>
    </div>
  `;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as InvitePayload;
    const { email, inviteLink, branchIdentifier, organizationName, subject, description, roleLabel } = body;
    if (!email || !inviteLink || !branchIdentifier || !organizationName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = new SmtpClient();
    await client.connectTLS({
      hostname: smtpConfig.hostname,
      port: smtpConfig.port,
      username: smtpConfig.username,
      password: smtpConfig.password,
    });

    await client.send({
      from: smtpConfig.from,
      to: email,
      subject:
        subject || `You're now the ${branchIdentifier} branch admin at ${organizationName}`,
      content: `Activate your account: ${inviteLink}`,
      html: buildEmailHtml({ ...body, description, roleLabel }),
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-branch-invite error', error);
    return new Response(JSON.stringify({ error: error.message ?? 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

