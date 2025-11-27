import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET = Deno.env.get('VENDOR_BUCKET') ?? 'vendor-docs';

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
    const form = await req.formData();
    const file = form.get('file');
    const vendorId = form.get('vendorId');
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'File is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!vendorId || typeof vendorId !== 'string') {
      return new Response(JSON.stringify({ error: 'vendorId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileName = `${crypto.randomUUID()}-${file.name}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${vendorId}/${fileName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'x-upsert': 'true',
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`Storage upload failed: ${text}`);
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${vendorId}/${encodeURIComponent(fileName)}`;

    return new Response(JSON.stringify({ path: `${vendorId}/${fileName}`, url: publicUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('upload-vendor-document error', error);
    return new Response(JSON.stringify({ error: error.message ?? 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

