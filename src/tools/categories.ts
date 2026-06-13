export type CategoryId = 'convert' | 'compress' | 'modify' | 'text' | 'generate' | 'calculate';
export type CategoryGroup = 'Files' | 'Utilities';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  tagline: string;
  icon: string;
  group: CategoryGroup;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'convert', label: 'Convert', tagline: 'Change a file from one format to another', icon: '⇄', group: 'Files' },
  { id: 'compress', label: 'Compress', tagline: 'Shrink files while keeping their format', icon: '↓', group: 'Files' },
  { id: 'modify', label: 'Modify', tagline: 'Edit images, PDFs and media', icon: '✎', group: 'Files' },
  { id: 'text', label: 'Text & Code', tagline: 'Encode, hash, format and transform text', icon: '{ }', group: 'Utilities' },
  { id: 'generate', label: 'Generate', tagline: 'Create UUIDs, passwords and placeholder text', icon: '✦', group: 'Utilities' },
  { id: 'calculate', label: 'Calculate', tagline: 'Unit & time converters', icon: '∑', group: 'Utilities' },
];

export const GROUPS: CategoryGroup[] = ['Files', 'Utilities'];

export function categoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id)!;
}
