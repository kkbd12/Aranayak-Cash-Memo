import { CashMemo, ShopSettings } from '../types';

/**
 * Extracts numerical suffix from a memo number string.
 * Examples: 'MEMO-1001' -> 1001, 'INV-2045' -> 2045, '1004' -> 1004, 'M-50' -> 50
 */
export function extractMemoNumber(memoNo: string, prefix = ''): number | null {
  if (!memoNo) return null;
  const clean = memoNo.trim();

  // Check with exact prefix match first
  if (prefix) {
    const trimmedPrefix = prefix.trim();
    if (clean.toUpperCase().startsWith(trimmedPrefix.toUpperCase())) {
      const remainder = clean.slice(trimmedPrefix.length).trim();
      const num = parseInt(remainder, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  // Match trailing digits (e.g. 'MEMO-1005' -> 1005)
  const trailingDigitsMatch = clean.match(/(\d+)$/);
  if (trailingDigitsMatch) {
    const num = parseInt(trailingDigitsMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // Match any sequence of numbers
  const anyDigitsMatch = clean.match(/(\d+)/);
  if (anyDigitsMatch) {
    const num = parseInt(anyDigitsMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return null;
}

/**
 * Computes the next guaranteed unique memo number based on all existing memos
 * and shop settings.
 */
export function getNextAvailableMemoNumber(
  memos: CashMemo[],
  settings?: Partial<ShopSettings>
): { memoNo: string; nextNumber: number } {
  const prefix = settings?.invoicePrefix !== undefined ? settings.invoicePrefix : 'MEMO-';
  const configuredNext = Number(settings?.nextMemoNumber) || 1001;

  let maxFound = 0;
  const existingSet = new Set<string>();

  if (Array.isArray(memos)) {
    for (const memo of memos) {
      if (memo && memo.memoNo) {
        const cleanNo = memo.memoNo.trim();
        existingSet.add(cleanNo.toUpperCase());
        const extracted = extractMemoNumber(cleanNo, prefix);
        if (extracted !== null && extracted > maxFound) {
          maxFound = extracted;
        }
      }
    }
  }

  // The next candidate number must be strictly greater than any existing memo's number
  // and at least what the user configured in settings
  let candidateNumber = Math.max(configuredNext, maxFound + 1);
  if (candidateNumber <= 0) candidateNumber = 1001;

  // Collision prevention loop: ensure candidate string is not already in existingSet
  let candidateStr = `${prefix}${candidateNumber}`;
  while (existingSet.has(candidateStr.toUpperCase())) {
    candidateNumber++;
    candidateStr = `${prefix}${candidateNumber}`;
  }

  return {
    memoNo: candidateStr,
    nextNumber: candidateNumber + 1,
  };
}

/**
 * Checks whether a given memo number is a duplicate of another memo in the list
 */
export function isMemoNoDuplicate(
  memoNo: string,
  memos: CashMemo[],
  excludeMemoId?: string
): boolean {
  if (!memoNo || !memoNo.trim() || !Array.isArray(memos)) return false;
  const target = memoNo.trim().toUpperCase();
  return memos.some(
    (m) => m && m.id !== excludeMemoId && m.memoNo && m.memoNo.trim().toUpperCase() === target
  );
}

/**
 * Automatically repairs any duplicate memo numbers found in an existing memo collection.
 * Sorts memos chronologically (oldest first), preserves the first occurrence of a number,
 * and reassigns subsequent duplicates to unique sequential numbers.
 */
export function repairDuplicateMemos(
  memos: CashMemo[],
  prefix = 'MEMO-'
): { memos: CashMemo[]; changed: boolean; repairedCount: number } {
  if (!Array.isArray(memos) || memos.length <= 1) {
    return { memos, changed: false, repairedCount: 0 };
  }

  // Sort chronologically ascending to preserve historical order
  const chronological = [...memos].sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );

  const seenMemoNos = new Set<string>();
  let maxNumberFound = 0;

  // First pass: register highest legitimate number and find seen
  for (const m of chronological) {
    const cleanNo = (m.memoNo || '').trim().toUpperCase();
    if (cleanNo && !seenMemoNos.has(cleanNo)) {
      seenMemoNos.add(cleanNo);
      const num = extractMemoNumber(cleanNo, prefix);
      if (num !== null && num > maxNumberFound) {
        maxNumberFound = num;
      }
    }
  }

  const registeredNumbers = new Set<string>();
  let changed = false;
  let repairedCount = 0;
  let nextAssignNumber = Math.max(1001, maxNumberFound + 1);

  const repairedList = chronological.map((memo) => {
    const rawNo = (memo.memoNo || '').trim();
    const upperNo = rawNo.toUpperCase();

    if (!rawNo || registeredNumbers.has(upperNo)) {
      // Duplicate or blank found! Reassign to next unique number
      changed = true;
      repairedCount++;
      let candidate = `${prefix}${nextAssignNumber}`;
      while (seenMemoNos.has(candidate.toUpperCase()) || registeredNumbers.has(candidate.toUpperCase())) {
        nextAssignNumber++;
        candidate = `${prefix}${nextAssignNumber}`;
      }
      registeredNumbers.add(candidate.toUpperCase());
      seenMemoNos.add(candidate.toUpperCase());
      nextAssignNumber++;
      return {
        ...memo,
        memoNo: candidate,
      };
    } else {
      registeredNumbers.add(upperNo);
      return memo;
    }
  });

  // Re-sort to newest first (descending) as used throughout the app
  repairedList.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return {
    memos: repairedList,
    changed,
    repairedCount,
  };
}
