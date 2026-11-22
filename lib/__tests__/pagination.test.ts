import { describe, expect, it } from 'vitest';
import {
  buildPageNumbers,
  buildPaginationHref,
  DEFAULT_PAGE_SIZE,
  paginateItems,
  parsePageNumber,
  parsePageSize,
} from '../pagination';

describe('Pagination utilities', () => {
  it('parses pageSize with whitelist (10, 20, 50) and falls back to 10', () => {
    expect(parsePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize(null)).toBe(10);
    expect(parsePageSize('')).toBe(10);
    expect(parsePageSize('10')).toBe(10);
    expect(parsePageSize('20')).toBe(20);
    expect(parsePageSize('50')).toBe(50);
    expect(parsePageSize('15')).toBe(10);
    expect(parsePageSize('100')).toBe(10);
    expect(parsePageSize('abc')).toBe(10);
    expect(parsePageSize(-10)).toBe(10);
  });

  it('parses page numbers and clamps invalid values to 1', () => {
    expect(parsePageNumber(undefined)).toBe(1);
    expect(parsePageNumber(null)).toBe(1);
    expect(parsePageNumber('0')).toBe(1);
    expect(parsePageNumber('-5')).toBe(1);
    expect(parsePageNumber('2.5')).toBe(1);
    expect(parsePageNumber('abc')).toBe(1);
    expect(parsePageNumber('3')).toBe(3);
    expect(parsePageNumber(4)).toBe(4);
  });

  it('slices items and computes accurate metadata across pages', () => {
    const items = Array.from({ length: 25 }, (_, i) => `item-${i + 1}`);

    const page1 = paginateItems(items, '1', '10');
    expect(page1.currentPage).toBe(1);
    expect(page1.pageSize).toBe(10);
    expect(page1.totalItems).toBe(25);
    expect(page1.totalPages).toBe(3);
    expect(page1.startIndex).toBe(1);
    expect(page1.endIndex).toBe(10);
    expect(page1.hasPrevPage).toBe(false);
    expect(page1.hasNextPage).toBe(true);
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0]).toBe('item-1');
    expect(page1.items[9]).toBe('item-10');

    const page3 = paginateItems(items, '3', '10');
    expect(page3.currentPage).toBe(3);
    expect(page3.startIndex).toBe(21);
    expect(page3.endIndex).toBe(25);
    expect(page3.hasPrevPage).toBe(true);
    expect(page3.hasNextPage).toBe(false);
    expect(page3.items).toEqual(['item-21', 'item-22', 'item-23', 'item-24', 'item-25']);
  });

  it('clamps out-of-range page numbers and handles empty arrays', () => {
    const items = Array.from({ length: 12 }, (_, i) => i + 1);

    const overflow = paginateItems(items, '99', '10');
    expect(overflow.currentPage).toBe(2);
    expect(overflow.startIndex).toBe(11);
    expect(overflow.endIndex).toBe(12);
    expect(overflow.items).toEqual([11, 12]);

    const empty = paginateItems([], '3', '20');
    expect(empty.currentPage).toBe(1);
    expect(empty.pageSize).toBe(20);
    expect(empty.totalItems).toBe(0);
    expect(empty.totalPages).toBe(1);
    expect(empty.startIndex).toBe(0);
    expect(empty.endIndex).toBe(0);
    expect(empty.hasPrevPage).toBe(false);
    expect(empty.hasNextPage).toBe(false);
    expect(empty.items).toEqual([]);
  });

  it('builds compact page number lists with ellipsis for large page counts', () => {
    expect(buildPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageNumbers(1, 10)).toEqual([1, 2, 3, 4, 'ellipsis', 10]);
    expect(buildPageNumbers(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
    expect(buildPageNumbers(10, 10)).toEqual([1, 'ellipsis', 7, 8, 9, 10]);
  });

  it('preserves active filter params and omits default page=1 / pageSize=10 in hrefs', () => {
    expect(
      buildPaginationHref(
        '/admin/anggota',
        { q: 'Sukar', gender: 'L', status: '' },
        1,
        10
      )
    ).toBe('/admin/anggota?q=Sukar&gender=L');

    expect(
      buildPaginationHref(
        '/admin/anggota',
        { q: 'Sukar', gender: '', status: 'alive' },
        2,
        20
      )
    ).toBe('/admin/anggota?q=Sukar&status=alive&page=2&pageSize=20');

    expect(
      buildPaginationHref('/admin/anggota', {}, 1, 10)
    ).toBe('/admin/anggota');
  });
});
