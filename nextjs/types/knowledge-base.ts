export interface Asset {
  id: string;
  title: string;
  description?: string;
  url: string;
  managed: boolean;
  type: string;
  size?: number;
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