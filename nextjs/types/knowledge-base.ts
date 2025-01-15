export interface KnowledgeBase {
  id: string;
  title: string;
  description: string;
  asset_ids: string[];
  created_at: string;
  updated_at: string;
}

export type KnowledgeBaseCreate = Omit<KnowledgeBase, 'id' | 'created_at' | 'updated_at'>; 