// app/api/batch-flow/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BatchFlowRequest, BatchFlowStreamMessage } from '@/utils/batch-flow-service';
import { fetchAsset } from '@/utils/asset-service';
import { fetchKnowledgeBase, fetchAssetsForKnowledgeBase } from '@/utils/knowledge-base-service';
import { ApiHeaders } from '@/app/utils/session/session';
import type { Asset } from '@/types/knowledge-base';

export const runtime = 'edge';

const getServiceHeaders = (): ApiHeaders => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
});

async function processStep(content: string, step: any, customInstructions?: string) {
  // TODO: Implement step processing logic
  return `Processed content with step ${JSON.stringify(step)}`;
}

interface BatchFlowRequestBody {
  file_ids: string[];
  knowledge_base_ids?: string[];
  asset_ids?: string[];
  steps: Array<{
    prompt_template_id: string;
    chat_model_id: string;
    persona_id: string;
  }>;
  customInstructions?: string;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    // Create Supabase client inside the handler to ensure env vars are available
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      {
        auth: {
          persistSession: false // Since this is a server environment
        }
      }
    );

    const body: BatchFlowRequestBody = await req.json()
    const { file_ids, knowledge_base_ids, asset_ids, steps, customInstructions } = body
    
    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid file_ids' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid steps' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const request: BatchFlowRequest = {
      file_ids,
      knowledge_base_ids,
      asset_ids,
      steps,
      customInstructions,
    };

    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendMessage = async (message: BatchFlowStreamMessage) => {
      await writer.write(encoder.encode(JSON.stringify(message) + '\n'));
    };

    // Process files
    const fileContents: Record<string, string> = {};
    for (const fileId of request.file_ids) {
      try {
        const { data: file, error } = await supabase
          .storage
          .from('batch-flow')
          .download(fileId);

        if (error || !file) {
          await sendMessage({
            type: 'error',
            error: `File not found: ${fileId}`,
          });
          continue;
        }

        fileContents[fileId] = await file.text();
      } catch (error) {
        await sendMessage({
          type: 'error',
          error: `Failed to process file ${fileId}: ${error}`,
        });
      }
    }

    // Process knowledge bases
    if (request.knowledge_base_ids) {
      const headers = getServiceHeaders();
      for (const kbId of request.knowledge_base_ids) {
        try {
          const kb = await fetchKnowledgeBase(kbId, headers);
          const assets = await fetchAssetsForKnowledgeBase(kbId, headers);
          fileContents[`kb_${kbId}`] = JSON.stringify({
            title: kb.title,
            description: kb.description,
            assets: assets.map((asset: Asset) => ({
              id: asset.id,
              title: asset.title,
              content: asset.content
            }))
          });
        } catch (error) {
          await sendMessage({
            type: 'error',
            error: `Failed to process knowledge base ${kbId}: ${error}`,
          });
        }
      }
    }

    // Process assets
    if (request.asset_ids) {
      const headers = getServiceHeaders();
      for (const assetId of request.asset_ids) {
        try {
          const asset = await fetchAsset(assetId, headers);
          fileContents[`asset_${assetId}`] = JSON.stringify({
            title: asset.title,
            content: asset.content
          });
        } catch (error) {
          await sendMessage({
            type: 'error',
            error: `Failed to process asset ${assetId}: ${error}`,
          });
        }
      }
    }

    // Process each file with the workflow steps
    for (const [fileId, content] of Object.entries(fileContents)) {
      await sendMessage({
        type: 'progress',
        fileId,
        fileName: fileId.startsWith('kb_') ? 'Knowledge Base' : 
                 fileId.startsWith('asset_') ? 'Asset' : fileId,
        currentStep: 0,
        totalSteps: request.steps.length,
      });

      // Process each step
      for (let stepIndex = 0; stepIndex < request.steps.length; stepIndex++) {
        const step = request.steps[stepIndex];
        
        try {
          const response = await processStep(content, step, request.customInstructions);
          
          await sendMessage({
            type: 'progress',
            fileId,
            fileName: fileId,
            currentStep: stepIndex + 1,
            totalSteps: request.steps.length,
            response,
          });
        } catch (error) {
          await sendMessage({
            type: 'error',
            error: `Failed to process step ${stepIndex + 1} for ${fileId}: ${error}`,
          });
        }
      }
    }

    await writer.close();
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in batch-flow route:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
