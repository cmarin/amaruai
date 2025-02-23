import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PromptTemplateFilters } from '@/utils/prompt-template-service';

interface PromptTemplateFiltersProps {
  categories: string[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  showFavorites: boolean;
  onFavoritesChange: (show: boolean) => void;
  showMyPrompts: boolean;
  onMyPromptsChange: (show: boolean) => void;
  filters: PromptTemplateFilters;
  onUpdateFilters: (filters: Partial<PromptTemplateFilters>) => void;
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
    <div className="flex gap-8 items-start">
      <div className="space-y-4">
        <h3 className="font-medium text-sm">Filters</h3>
        <div className="space-y-2">
          <Select
            value={selectedCategory || ''}
            onValueChange={(value) => onCategoryChange(value || null)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
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
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-sm">Sort</h3>
        <Select
          value={filters.sort_by}
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
  );
} 