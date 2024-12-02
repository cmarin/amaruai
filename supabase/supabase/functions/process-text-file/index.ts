import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "jsr:@std/http@^0.224.0/server"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?no-check"
import { resolvePDFJS } from 'npm:pdfjs-serverless'
import mammoth from "npm:mammoth@1.6.0"

serve(async (req) => {
  try {
    const payload = await req.json();
    const storageId = payload.record.id;
    const supabaseClient = createClient(
      Deno.env.get('URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    const { data: asset, error: assetError } = await supabaseClient
      .from('assets')
      .select('*')
      .eq('storage_id', storageId)
      .single();

    if (assetError || !asset) {
      throw new Error(`No asset found with storage_id: ${storageId}`);
    }

    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('amaruai-dev')
      .download(asset.file_url);

    if (downloadError) {
      throw downloadError;
    }

    let extractedText = '';

    if (asset.mime_type === 'application/pdf') {
      const { getDocument } = await resolvePDFJS();
      const typedArray = new Uint8Array(await fileData.arrayBuffer());
      const pdf = await getDocument({ data: typedArray, useSystemFonts: true }).promise;
      const textContent = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textContent.push(content.items.map(item => item.str).join(' '));
      }

      extractedText = textContent.join('\n');
    } else if (asset.mime_type === 'text/plain') {
      extractedText = new TextDecoder().decode(fileData);
    } else if (asset.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const buffer = await fileData.arrayBuffer();
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else {
      throw new Error(`Unsupported mime type: ${asset.mime_type}`);
    }

    const { error: updateError } = await supabaseClient
      .from('assets')
      .update({
        content: extractedText,
        token_count: extractedText.split(/\s+/).length,
        updated_at: new Date().toISOString()
      })
      .eq('id', asset.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        message: 'Text extraction successful',
        asset_id: asset.id,
        text_length: extractedText.length
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

});