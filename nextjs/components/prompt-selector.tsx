import { useState, useEffect, ReactNode, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PromptTemplate, fetchPromptTemplates } from '@/utils/prompt-template-service'
import { Category } from '@/utils/category-service'
import { Star, Plus, Loader2 } from 'lucide-react'
import { useSession } from '@/app/utils/session/session'

type PromptSelectorProps = {
  prompts: PromptTemplate[]
  categories: Category[]
  onSelectPrompt: (prompt: PromptTemplate) => void
  children: ReactNode
  onLoad?: (newPrompts: PromptTemplate[]) => void
}

// Simple debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function PromptSelector({ prompts, categories, onSelectPrompt, children, onLoad }: PromptSelectorProps) {
  const [groupedPrompts, setGroupedPrompts] = useState<{ [key: string]: PromptTemplate[] }>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<PromptTemplate[]>([])
  const [offset, setOffset] = useState(30) // Initial load is ~30 prompts
  const { getApiHeaders } = useSession()

  // Group the prompts into categories
  const groupPromptsByCategory = useCallback((promptsToGroup: PromptTemplate[], useSearchResults = false) => {
    // Safety check - if promptsToGroup is empty or undefined, return empty groups
    if (!promptsToGroup || promptsToGroup.length === 0) {
      console.warn('No prompts to group, returning empty structure');
      const emptyGroups: { [key: string]: PromptTemplate[] } = { 'Favorites': [] };
      
      // Still add categories if we're not in search mode
      if (!useSearchResults) {
        categories.forEach(category => {
          emptyGroups[category.name] = [];
        });
        emptyGroups['Uncategorized'] = [];
      }
      return emptyGroups;
    }
    
    // Enhanced logging for debugging
    console.log('Grouping prompts:', promptsToGroup.length);
    console.log('Favorites count (is_favorite):', promptsToGroup.filter(p => p.is_favorite).length);
    
    // Check if any prompts have an is_favorited property (API might return this)
    const hasFavoritedProps = promptsToGroup.some(p => (p as any).is_favorited);
    if (hasFavoritedProps) {
      console.log('Favorites count (is_favorited):', promptsToGroup.filter(p => (p as any).is_favorited).length);
    }
    
    // Initialize with special categories in a specific order
    const newGroupedPrompts: { [key: string]: PromptTemplate[] } = {}
    
    // Identify favorites - check is_favorite and possibly is_favorited property
    const favoritePrompts = promptsToGroup.filter(prompt => 
      prompt.is_favorite || (hasFavoritedProps && (prompt as any).is_favorited)
    );
    
    console.log('Total favorites identified:', favoritePrompts.length);
    
    // Create a Set of favorite prompt IDs for quickly checking
    const favoriteIds = new Set(favoritePrompts.map(p => p.id));
    
    // Add Favorites category ALWAYS to the top (even if empty)
    newGroupedPrompts['Favorites'] = favoritePrompts;
    
    // Always add all categories from the categories prop
    // This ensures we have ALL categories, not just ones with prompts
    categories.forEach(category => {
      if (!newGroupedPrompts[category.name]) {
        newGroupedPrompts[category.name] = [];
      }
    });
    
    // Create Uncategorized category if it doesn't exist
    if (!newGroupedPrompts['Uncategorized']) {
      newGroupedPrompts['Uncategorized'] = [];
    }
    
    // Group prompts by category - IMPORTANT: Skip favorites in regular categories
    promptsToGroup.forEach(prompt => {
      // Skip this prompt in regular categories if it's a favorite
      if (favoriteIds.has(prompt.id)) {
        return; // Skip to next prompt
      }
      
      if (!prompt.categories || prompt.categories.length === 0) {
        // If prompt has no categories, add to 'Uncategorized'
        newGroupedPrompts['Uncategorized'].push(prompt);
      } else {
        prompt.categories.forEach(category => {
          if (newGroupedPrompts[category.name]) {
            newGroupedPrompts[category.name].push(prompt);
          } else {
            // Create category if it doesn't exist
            newGroupedPrompts[category.name] = [prompt];
          }
        });
      }
    });
    
    // When in search mode, we want to remove empty categories
    if (useSearchResults) {
      // Remove empty categories except Favorites (keep it even if empty)
      Object.keys(newGroupedPrompts).forEach(key => {
        if (newGroupedPrompts[key].length === 0 && key !== 'Favorites') {
          delete newGroupedPrompts[key];
        }
      });
    } else {
      // In normal mode, only remove empty categories that are not special categories
      Object.keys(newGroupedPrompts).forEach(key => {
        if (newGroupedPrompts[key].length === 0 && 
            key !== 'Favorites' && 
            key !== 'Uncategorized') {
          delete newGroupedPrompts[key];
        }
      });
    }
    
    // Log the result to help debug
    console.log('Grouped prompts categories:', Object.keys(newGroupedPrompts));
    console.log('Favorites category count:', newGroupedPrompts['Favorites']?.length || 0);
    console.log('All categories with counts:', Object.entries(newGroupedPrompts).map(([key, val]) => 
      `${key}: ${val.length}`).join(', '));
    
    return newGroupedPrompts;
  }, [categories]);

  // Handle initial grouping of prompts when component mounts or prompts change
  useEffect(() => {
    console.log('Initial prompts useEffect - prompt count:', prompts.length);
    
    if (prompts.length > 0) {
      const grouped = groupPromptsByCategory(prompts, false);
      console.log('Setting initial grouped prompts with categories:', Object.keys(grouped).length);
      setGroupedPrompts(grouped);
    }
  }, [prompts, groupPromptsByCategory]);

  // When the popover opens, make sure we're showing all prompts and not just search results
  useEffect(() => {
    if (isOpen && !searchTerm && prompts.length > 0) {
      console.log('Popover opened - regrouping all prompts');
      setGroupedPrompts(groupPromptsByCategory(prompts, false));
    }
  }, [isOpen, searchTerm, prompts, groupPromptsByCategory]);

  // Search API function
  const searchPromptTemplates = useCallback(async (query: string) => {
    if (!query.trim()) {
      // If search is cleared, reset to show original prompts
      console.log('Search cleared - resetting to all prompts');
      setSearchResults([]);
      
      // Make sure we regroup ALL prompts when search is cleared
      if (prompts.length > 0) {
        const grouped = groupPromptsByCategory(prompts, false);
        console.log('Resetting to grouped prompts with categories:', Object.keys(grouped).length);
        setGroupedPrompts(grouped);
      }
      
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    try {
      const headers = getApiHeaders();
      if (!headers) {
        console.error('No valid headers available');
        setIsSearching(false);
        return;
      }
      
      console.log(`Searching for: "${query}"`);
      
      // Call the API with the query parameter
      const results = await fetchPromptTemplates(headers, {
        query: query,
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      
      console.log(`Found ${results.length} search results for "${query}"`);
      
      // Update search results
      setSearchResults(results);
      
      // Group the search results into categories
      if (results.length > 0) {
        setGroupedPrompts(groupPromptsByCategory(results, true));
      } else {
        // If no results, show empty state but keep 'Favorites' category
        setGroupedPrompts({ 'Favorites': [] });
      }
    } catch (error) {
      console.error('Error searching prompt templates:', error);
    } finally {
      setIsSearching(false);
    }
  }, [getApiHeaders, prompts, groupPromptsByCategory]);
  
  // Create a debounced version of the search function
  const debouncedSearch = useCallback(
    debounce((query: string) => searchPromptTemplates(query), 500),
    [searchPromptTemplates]
  );

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchTerm(query);
    debouncedSearch(query);
  };

  // Ensure categories are displayed in the correct order
  const orderedCategories = Object.entries(groupedPrompts).sort((a, b) => {
    // Favorites always first
    if (a[0] === 'Favorites') return -1;
    if (b[0] === 'Favorites') return 1;
    // Uncategorized always last
    if (a[0] === 'Uncategorized') return 1;
    if (b[0] === 'Uncategorized') return -1;
    // Everything else alphabetically
    return a[0].localeCompare(b[0]);
  });

  // Log the ordered categories to help debug
  useEffect(() => {
    if (orderedCategories.length > 0) {
      console.log('Ordered categories:', orderedCategories.map(([name]) => name).join(', '));
      console.log('Category counts:', orderedCategories.map(([name, prompts]) => 
        `${name}: ${prompts.length}`).join(', '));
      console.log('Total prompts displayed:', orderedCategories.reduce((total, [_, prompts]) => 
        total + prompts.length, 0));
    }
  }, [orderedCategories]);

  const handleLoadMore = async () => {
    if (isLoadingMore || searchTerm) return; // Don't load more if we're searching
    
    setIsLoadingMore(true)
    try {
      const headers = getApiHeaders()
      if (!headers) {
        console.error('No valid headers available')
        setIsLoadingMore(false)
        return
      }

      console.log(`Loading more prompts starting from offset ${offset}`);
      
      // Add a delay to prevent rapid fire requests
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Fetch next batch of prompts
      const additionalPrompts = await fetchPromptTemplates(headers, {
        skip: offset,
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'desc'
      })

      if (additionalPrompts.length > 0) {
        console.log(`Loaded ${additionalPrompts.length} additional prompts`);
        
        // Increment the offset for next load
        setOffset(prev => prev + additionalPrompts.length)
        
        // Notify parent component about new prompts
        if (onLoad) {
          onLoad(additionalPrompts)
        }
      } else {
        console.log('No additional prompts found');
      }
    } catch (error) {
      console.error('Error loading more prompts:', error)
    } finally {
      // Add a small delay before allowing more loads to prevent accidental double-clicks
      setTimeout(() => {
        setIsLoadingMore(false)
      }, 500);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={value => {
      // When opening the popover, ensure we reset to showing all prompts
      if (value === true && !isOpen && !searchTerm) {
        console.log('Popover opening - ensuring all prompts are displayed');
        // Force a regroup on open
        setGroupedPrompts(groupPromptsByCategory(prompts, false));
      }
      setIsOpen(value);
    }}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <div className="p-2 relative">
          <Input
            type="text"
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="mb-2"
          />
          {isSearching && (
            <div className="absolute right-4 top-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {orderedCategories.length > 0 ? (
            <>
              {orderedCategories.map(([category, categoryPrompts]) => (
                <div key={category} className="p-2">
                  <h3 className="font-semibold mb-2 flex items-center">
                    {category === 'Favorites' && <Star className="h-4 w-4 mr-1 text-yellow-400" />}
                    {category}
                  </h3>
                  {categoryPrompts.length > 0 ? (
                    categoryPrompts.map(prompt => (
                      <Button
                        key={prompt.id}
                        variant="ghost"
                        className="w-full justify-start text-left"
                        onClick={() => {
                          onSelectPrompt(prompt)
                          setIsOpen(false)
                        }}
                      >
                        {prompt.title}
                      </Button>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 py-1 px-2">
                      No prompts in this category
                    </div>
                  )}
                </div>
              ))}
              {!searchTerm && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    className="w-full justify-center text-blue-600 hover:text-blue-800"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Loading...' : (
                      <>
                        <Plus className="h-4 w-4 mr-1" />
                        Load More
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'No prompts found for your search' : 'No prompts found'}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}