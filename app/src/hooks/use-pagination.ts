import { useState } from "react";

export interface UsePaginationProps {
  defaultPageSize?: number;
  totalItems: number;
}

export interface UsePaginationReturn {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  canGoToPreviousPage: boolean;
  canGoToNextPage: boolean;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
}

export function usePagination({
  defaultPageSize = 10,
  totalItems,
}: UsePaginationProps): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const canGoToPreviousPage = currentPage > 1;
  const canGoToNextPage = currentPage < totalPages;

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPreviousPage = () => {
    if (canGoToPreviousPage) setCurrentPage(currentPage - 1);
  };
  const goToNextPage = () => {
    if (canGoToNextPage) setCurrentPage(currentPage + 1);
  };

  // Reset to first page when page size changes
  if (pageSize !== defaultPageSize && currentPage > totalPages) {
    setCurrentPage(1);
  }

  return {
    currentPage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    setCurrentPage,
    setPageSize,
    goToFirstPage,
    goToLastPage,
    canGoToPreviousPage,
    canGoToNextPage,
    goToPreviousPage,
    goToNextPage,
  };
}
