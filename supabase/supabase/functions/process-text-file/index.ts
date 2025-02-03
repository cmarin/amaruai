import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "jsr:@std/http@^0.224.0/server"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?no-check"
import { resolvePDFJS } from 'npm:pdfjs-serverless'
import mammoth from "npm:mammoth@1.6.0"
import JSZip from "https://esm.sh/jszip@3.10.1"
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.3.2"

// Simple token estimation function
function estimateTokenCount(text: string): number {
  return text.split(/\s+/).length + (text.match(/[.,!?;]|\n/g)?.length || 0);
}

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log('Received payload:', JSON.stringify(payload));
    const storageId = payload.record.id;
    console.log('Processing storage ID:', storageId);
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
      console.error('Asset error:', assetError);
      throw new Error(`No asset found with storage_id: ${storageId}`);
    }

    console.log('Asset found:', JSON.stringify(asset));

    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('amaruai-dev')
      .download(asset.file_url);

    if (downloadError) {
      console.error('Download error:', downloadError);
      throw downloadError;
    }

    console.log('File downloaded successfully, mime type:', asset.mime_type);

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
    } else if (asset.mime_type === 'text/plain' || asset.mime_type === 'text/markdown') {
      const buffer = await fileData.arrayBuffer();
      extractedText = new TextDecoder().decode(buffer);
    } else if (asset.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const buffer = await fileData.arrayBuffer();
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else if (asset.mime_type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      const buffer = await fileData.arrayBuffer();
      const zip = new JSZip();
      const contents = await zip.loadAsync(buffer);
      const texts = [];
      
      const parser = new XMLParser({
        ignoreAttributes: false,
        parseAttributeValue: true
      });
      
      // Process each slide XML file
      for (const filename of Object.keys(contents.files)) {
        if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
          const content = await contents.files[filename].async('string');
          const result = parser.parse(content);
          
          // Navigate through the parsed XML to find text elements
          const extractTextFromNode = (node: any) => {
            if (typeof node === 'string') {
              texts.push(node.trim());
            } else if (node && typeof node === 'object') {
              for (const key in node) {
                if (key === 'a:t') {
                  // Found text content
                  if (typeof node[key] === 'string') {
                    texts.push(node[key].trim());
                  }
                } else {
                  extractTextFromNode(node[key]);
                }
              }
            } else if (Array.isArray(node)) {
              node.forEach(item => extractTextFromNode(item));
            }
          };
          
          extractTextFromNode(result);
        }
      }
      
      extractedText = texts.filter(text => text.length > 0).join('\n');
    } else {
      throw new Error(`Unsupported mime type: ${asset.mime_type}`);
    }

    const { error: updateError } = await supabaseClient
      .from('assets')
      .update({
        content: extractedText,
        token_count: estimateTokenCount(extractedText),
        status: 'completed',
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
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        details: error.toString()
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

});