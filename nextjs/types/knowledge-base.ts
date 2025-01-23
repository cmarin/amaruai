export interface Asset {
  id: string;
  title: string;
  file_name: string;
  description?: string;
  url: string;
  managed: boolean;
  type: string;
  mime_type: string;
  file_type: string;
  size?: number;
  content?: string;
  created_at: string;
  updated_at: string;
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