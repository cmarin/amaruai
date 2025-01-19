import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Fetch the asset from the database
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('content')
      .eq('id', params.id)
      .single();

    if (assetError) {
      console.error('Error fetching asset:', assetError);
      return NextResponse.json(
        { error: 'Failed to fetch asset' },
        { status: 500 }
      );
    }

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ transcript: asset.content });
  } catch (error) {
    console.error('Error in transcript endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
