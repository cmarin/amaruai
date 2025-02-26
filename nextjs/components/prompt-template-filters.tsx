import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PromptTemplateFilters as PromptTemplateFiltersType } from '@/utils/prompt-template-service';

interface PromptTemplateFiltersProps {
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  showFavorites: boolean;
  onFavoritesChange: (show: boolean) => void;
  showMyPrompts: boolean;
  onMyPromptsChange: (show: boolean) => void;
  filters: PromptTemplateFiltersType;
  onUpdateFilters: (filters: Partial<PromptTemplateFiltersType>) => void;
}

export function PromptTemplateFilters({
  categories,
  selectedCategory,
  onCategoryChange,
  showFavorites,
  onFavoritesChange,
  showMyPrompts,
  onMyPromptsChange,
  filters,
  onUpdateFilters,
}: PromptTemplateFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Select
          value={selectedCategory || 'all'}
          onValueChange={(value) => onCategoryChange(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex items-center space-x-2">
          <Checkbox
            id="favorites"
            checked={showFavorites}
            onCheckedChange={onFavoritesChange}
          />
          <Label htmlFor="favorites">Favorites</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="myPrompts"
            checked={showMyPrompts}
            onCheckedChange={onMyPromptsChange}
          />
          <Label htmlFor="myPrompts">My Prompts</Label>
        </div>

        <div className="ml-auto">
          <Select
            value={filters.sort_by || 'created_at'}
            onValueChange={(value: any) => onUpdateFilters({ sort_by: value })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Creation Date</SelectItem>
              <SelectItem value="updated_at">Last Modified</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
} 