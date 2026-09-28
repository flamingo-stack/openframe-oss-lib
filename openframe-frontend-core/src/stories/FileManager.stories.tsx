import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { FileManager } from '../components/ui/file-manager/file-manager';
import type { FileItem } from '../components/ui/file-manager/types';

const sampleFiles: FileItem[] = [
  { id: '1', name: 'Documents', type: 'folder', modified: '2026-03-01', path: '/Documents' },
  { id: '2', name: 'Pictures', type: 'folder', modified: '2026-02-28', path: '/Pictures' },
  { id: '3', name: 'Downloads', type: 'folder', modified: '2026-03-05', path: '/Downloads' },
  { id: '4', name: 'readme.md', type: 'file', size: '4.2 KB', modified: '2026-03-08', path: '/readme.md' },
  { id: '5', name: 'config.json', type: 'file', size: '1.1 KB', modified: '2026-03-07', path: '/config.json' },
  { id: '6', name: 'deploy.sh', type: 'file', size: '856 B', modified: '2026-03-06', path: '/deploy.sh' },
  { id: '7', name: 'package.json', type: 'file', size: '2.3 KB', modified: '2026-03-04', path: '/package.json' },
  { id: '8', name: '.env.local', type: 'file', size: '312 B', modified: '2026-02-20', path: '/.env.local' },
];

const meta = {
  title: 'UI/FileManager',
  component: FileManager,
  args: {
    files: sampleFiles,
    currentPath: '/',
    selectedFiles: [],
    onNavigate: fn(),
    onBreadcrumbClick: fn(),
    onSearch: fn(),
    onSelectFile: fn(),
    onSelectAll: fn(),
    onFileAction: fn(),
    onFileClick: fn(),
    onFolderOpen: fn(),
  },
  argTypes: {
    loading: { control: 'boolean' },
    showCheckboxes: { control: 'boolean' },
    showSearch: { control: 'boolean' },
    showActions: { control: 'boolean' },
    canPaste: { control: 'boolean' },
    disableSearch: { control: 'boolean' },
    isSearching: { control: 'boolean' },
    currentPath: { control: 'text' },
    searchQuery: { control: 'text' },
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof FileManager>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default file manager at root path with files and folders.
 */
export const Default: Story = {
  args: {},
};

/**
 * Navigated into a subfolder with a deep breadcrumb path.
 */
export const NestedPath: Story = {
  args: {
    currentPath: '/Documents/Projects/my-app',
    files: [
      { id: '1', name: 'src', type: 'folder', modified: '2026-03-08', path: '/Documents/Projects/my-app/src' },
      {
        id: '2',
        name: 'node_modules',
        type: 'folder',
        modified: '2026-03-01',
        path: '/Documents/Projects/my-app/node_modules',
      },
      {
        id: '3',
        name: 'index.ts',
        type: 'file',
        size: '1.5 KB',
        modified: '2026-03-08',
        path: '/Documents/Projects/my-app/index.ts',
      },
      {
        id: '4',
        name: 'tsconfig.json',
        type: 'file',
        size: '680 B',
        modified: '2026-03-02',
        path: '/Documents/Projects/my-app/tsconfig.json',
      },
    ],
  },
};

/**
 * Files selected - enables Copy, Cut, and Select All actions.
 */
export const WithSelection: Story = {
  args: {
    selectedFiles: ['4', '5'],
  },
};

/**
 * Paste available from clipboard.
 */
export const WithPasteAvailable: Story = {
  args: {
    selectedFiles: ['4'],
    canPaste: true,
  },
};

/**
 * Loading state while fetching directory contents.
 */
export const Loading: Story = {
  args: {
    loading: true,
    files: [],
  },
};

/**
 * Active search with query and results.
 */
export const Searching: Story = {
  args: {
    searchQuery: 'config',
    files: [
      { id: '5', name: 'config.json', type: 'file', size: '1.1 KB', modified: '2026-03-07', path: '/config.json' },
      {
        id: '9',
        name: 'tsconfig.json',
        type: 'file',
        size: '680 B',
        modified: '2026-03-02',
        path: '/src/tsconfig.json',
      },
    ],
    resultsCount: 2,
  },
};

/**
 * Search in progress with loading indicator.
 */
export const SearchInProgress: Story = {
  args: {
    searchQuery: 'deploy',
    isSearching: true,
  },
};

/**
 * Empty directory with no files.
 */
export const EmptyDirectory: Story = {
  args: {
    files: [],
    currentPath: '/empty-folder',
  },
};

/**
 * Minimal UI - no search bar, no action bar, no checkboxes.
 */
export const MinimalUI: Story = {
  args: {
    showSearch: false,
    showActions: false,
    showCheckboxes: false,
  },
};

/**
 * Windows-style path with drive letter.
 */
export const WindowsPath: Story = {
  args: {
    currentPath: 'C:\\Users\\admin\\Desktop',
    files: [
      {
        id: '1',
        name: 'Projects',
        type: 'folder',
        modified: '2026-03-08',
        path: 'C:\\Users\\admin\\Desktop\\Projects',
      },
      {
        id: '2',
        name: 'notes.txt',
        type: 'file',
        size: '2.1 KB',
        modified: '2026-03-07',
        path: 'C:\\Users\\admin\\Desktop\\notes.txt',
      },
    ],
  },
};
