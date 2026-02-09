import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/pagination';

const meta = {
  title: 'UI/Pagination',
  component: Pagination,
  argTypes: {
    currentPage: {
      control: { type: 'number', min: 1 },
    },
    totalPages: {
      control: { type: 'number', min: 1 },
    },
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default pagination with 10 pages.
 */
export const Default: Story = {
  args: {
    currentPage: 1,
    totalPages: 10,
    onPageChange: () => {},
  },
};

/**
 * Pagination on first page.
 */
export const FirstPage: Story = {
  args: {
    currentPage: 1,
    totalPages: 10,
    onPageChange: () => {},
  },
};

/**
 * Pagination in the middle.
 */
export const MiddlePage: Story = {
  args: {
    currentPage: 5,
    totalPages: 10,
    onPageChange: () => {},
  },
};

/**
 * Pagination on last page.
 */
export const LastPage: Story = {
  args: {
    currentPage: 10,
    totalPages: 10,
    onPageChange: () => {},
  },
};

/**
 * Pagination with few pages (no ellipsis).
 */
export const FewPages: Story = {
  args: {
    currentPage: 2,
    totalPages: 3,
    onPageChange: () => {},
  },
};

/**
 * Pagination with single page.
 */
export const SinglePage: Story = {
  args: {
    currentPage: 1,
    totalPages: 1,
    onPageChange: () => {},
  },
};

/**
 * Pagination with many pages.
 */
export const ManyPages: Story = {
  args: {
    currentPage: 50,
    totalPages: 100,
    onPageChange: () => {},
  },
};

/**
 * Interactive pagination with state.
 */
export const Interactive: Story = {
  args: {
    currentPage: 1,
    totalPages: 10,
    onPageChange: () => {},
  },
  render: function InteractivePagination() {
    const [page, setPage] = useState(1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <p style={{ color: 'var(--ods-text-secondary)', fontSize: '14px' }}>
          Current page: {page} of 10
        </p>
        <Pagination currentPage={page} totalPages={10} onPageChange={setPage} />
      </div>
    );
  },
};

/**
 * Interactive pagination with many pages.
 */
export const InteractiveManyPages: Story = {
  args: {
    currentPage: 1,
    totalPages: 50,
    onPageChange: () => {},
  },
  render: function InteractiveManyPages() {
    const [page, setPage] = useState(1);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
        <p style={{ color: 'var(--ods-text-secondary)', fontSize: '14px' }}>
          Current page: {page} of 50
        </p>
        <Pagination currentPage={page} totalPages={50} onPageChange={setPage} />
      </div>
    );
  },
};

/**
 * Composable pagination using individual components.
 */
export const Composable: Story = {
  args: {
    currentPage: 3,
    totalPages: 10,
    onPageChange: () => {},
  },
  render: () => (
    <nav role="navigation" aria-label="pagination" className="mx-auto flex w-full justify-center">
      <PaginationContent className="gap-1">
        <PaginationItem>
          <PaginationPrevious />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink>1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink>2</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink className="bg-ods-accent text-ods-text-on-accent">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink>10</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext />
        </PaginationItem>
      </PaginationContent>
    </nav>
  ),
};

/**
 * All pagination states showcase.
 */
export const AllStates: Story = {
  args: {
    currentPage: 1,
    totalPages: 10,
    onPageChange: () => {},
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <p style={{ color: 'var(--ods-text-secondary)', fontSize: '12px', marginBottom: '8px' }}>First page (1 of 10)</p>
        <Pagination currentPage={1} totalPages={10} onPageChange={() => {}} />
      </div>
      <div>
        <p style={{ color: 'var(--ods-text-secondary)', fontSize: '12px', marginBottom: '8px' }}>Middle page (5 of 10)</p>
        <Pagination currentPage={5} totalPages={10} onPageChange={() => {}} />
      </div>
      <div>
        <p style={{ color: 'var(--ods-text-secondary)', fontSize: '12px', marginBottom: '8px' }}>Last page (10 of 10)</p>
        <Pagination currentPage={10} totalPages={10} onPageChange={() => {}} />
      </div>
      <div>
        <p style={{ color: 'var(--ods-text-secondary)', fontSize: '12px', marginBottom: '8px' }}>Few pages (2 of 3)</p>
        <Pagination currentPage={2} totalPages={3} onPageChange={() => {}} />
      </div>
      <div>
        <p style={{ color: 'var(--ods-text-secondary)', fontSize: '12px', marginBottom: '8px' }}>Many pages (50 of 100)</p>
        <Pagination currentPage={50} totalPages={100} onPageChange={() => {}} />
      </div>
    </div>
  ),
};
