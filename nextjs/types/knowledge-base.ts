export interface Asset {
  id: string;
  title: string;
  file_name: string;
  file_url: string;
  file_type: string;
  mime_type: string;
  size: number;
  content: string;
  token_count: number;
  status: string | null;
  uploaded_by: string;
  storage_id: string;
  created_at: string;
  updated_at: string;
  managed?: boolean;
}

export interface KnowledgeBase {
  id: string;
  title: string;
  description: string;
  assets: Asset[];
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseCreate {
  title: string;
  description: string;
  asset_ids: string[];
} 