import React from 'react';
import { Search, LayoutGrid, List, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterStatus, SortOption, ViewMode } from '../types';

interface LabFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  statusFilter: FilterStatus;
  setStatusFilter: (val: FilterStatus) => void;
  sortOption: SortOption;
  setSortOption: (val: SortOption) => void;
  viewMode: ViewMode;
  setViewMode: (val: ViewMode) => void;
}

export function LabFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sortOption,
  setSortOption,
  viewMode,
  setViewMode,
}: LabFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-card p-4 rounded-xl border border-border/50 shadow-sm mb-6 sticky top-20 z-30">
      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search labs by name, description, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-slate-50 dark:bg-slate-900 border-border/50 h-10 w-full"
        />
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
          <SelectTrigger className="w-full sm:w-[140px] h-10 bg-slate-50 dark:bg-slate-900 border-border/50">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <SelectValue placeholder="Status" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Labs">All Status</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Not Started">Not Started</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
          <SelectTrigger className="w-full sm:w-[160px] h-10 bg-slate-50 dark:bg-slate-900 border-border/50">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Name">Name (A-Z)</SelectItem>
            <SelectItem value="Recently Accessed">Recently Accessed</SelectItem>
            <SelectItem value="Credits">Credits (Low to High)</SelectItem>
            <SelectItem value="Duration">Duration (Shortest)</SelectItem>
          </SelectContent>
        </Select>

        <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={`h-8 w-8 p-0 ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-foreground shadow-sm hover:bg-white hover:text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={`h-8 w-8 p-0 ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-foreground shadow-sm hover:bg-white hover:text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
