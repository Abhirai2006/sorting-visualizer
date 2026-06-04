export type StepKind = "compare" | "swap" | "overwrite" | "mark-sorted" | "pivot" | "done";

export interface Step {
  kind: StepKind;
  indices: number[];
  array: number[];
  pointers?: Record<string, number>;
  note?: string;
}

export type AlgoId = "bubble" | "selection" | "insertion" | "merge" | "quick";

const swap = (a: number[], i: number, j: number) => {
  [a[i], a[j]] = [a[j], a[i]];
};

export function bubbleSort(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a.length - i - 1; j++) {
      steps.push({
        kind: "compare", indices: [j, j + 1], array: [...a],
        pointers: { i, j }, note: `Compare a[${j}]=${a[j]} with a[${j + 1}]=${a[j + 1]}`,
      });
      if (a[j] > a[j + 1]) {
        swap(a, j, j + 1);
        steps.push({
          kind: "swap", indices: [j, j + 1], array: [...a],
          pointers: { i, j }, note: `Swap — a[${j}] > a[${j + 1}]`,
        });
      }
    }
    steps.push({
      kind: "mark-sorted", indices: [a.length - i - 1], array: [...a],
      pointers: { i }, note: `Position ${a.length - i - 1} locked in`,
    });
  }
  steps.push({ kind: "done", indices: [], array: [...a], note: "Sorted ✓" });
  return steps;
}

export function selectionSort(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  for (let i = 0; i < a.length; i++) {
    let min = i;
    for (let j = i + 1; j < a.length; j++) {
      steps.push({
        kind: "compare", indices: [min, j], array: [...a],
        pointers: { i, j, min }, note: `Check if a[${j}]=${a[j]} < min a[${min}]=${a[min]}`,
      });
      if (a[j] < a[min]) min = j;
    }
    if (min !== i) {
      swap(a, i, min);
      steps.push({
        kind: "swap", indices: [i, min], array: [...a],
        pointers: { i, min }, note: `Swap min into position ${i}`,
      });
    }
    steps.push({ kind: "mark-sorted", indices: [i], array: [...a], pointers: { i } });
  }
  steps.push({ kind: "done", indices: [], array: [...a], note: "Sorted ✓" });
  return steps;
}

export function insertionSort(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  for (let i = 1; i < a.length; i++) {
    let j = i;
    while (j > 0) {
      steps.push({
        kind: "compare", indices: [j - 1, j], array: [...a],
        pointers: { i, j }, note: `Insert: compare a[${j - 1}]=${a[j - 1]} and a[${j}]=${a[j]}`,
      });
      if (a[j - 1] > a[j]) {
        swap(a, j - 1, j);
        steps.push({
          kind: "swap", indices: [j - 1, j], array: [...a],
          pointers: { i, j }, note: `Shift a[${j}] left`,
        });
        j--;
      } else break;
    }
  }
  for (let i = 0; i < a.length; i++) steps.push({ kind: "mark-sorted", indices: [i], array: [...a] });
  steps.push({ kind: "done", indices: [], array: [...a], note: "Sorted ✓" });
  return steps;
}

export function mergeSort(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  const merge = (l: number, m: number, r: number) => {
    const left = a.slice(l, m + 1);
    const right = a.slice(m + 1, r + 1);
    let i = 0, j = 0, k = l;
    while (i < left.length && j < right.length) {
      steps.push({
        kind: "compare", indices: [l + i, m + 1 + j], array: [...a],
        pointers: { low: l, mid: m, high: r, k }, note: `Merge: compare ${left[i]} vs ${right[j]}`,
      });
      if (left[i] <= right[j]) a[k] = left[i++];
      else a[k] = right[j++];
      steps.push({
        kind: "overwrite", indices: [k], array: [...a],
        pointers: { low: l, mid: m, high: r, k }, note: `Write a[${k}] = ${a[k]}`,
      });
      k++;
    }
    while (i < left.length) { a[k] = left[i++]; steps.push({ kind: "overwrite", indices: [k], array: [...a], pointers: { low: l, mid: m, high: r, k } }); k++; }
    while (j < right.length) { a[k] = right[j++]; steps.push({ kind: "overwrite", indices: [k], array: [...a], pointers: { low: l, mid: m, high: r, k } }); k++; }
  };
  const sort = (l: number, r: number) => {
    if (l >= r) return;
    const m = Math.floor((l + r) / 2);
    sort(l, m);
    sort(m + 1, r);
    merge(l, m, r);
  };
  sort(0, a.length - 1);
  for (let i = 0; i < a.length; i++) steps.push({ kind: "mark-sorted", indices: [i], array: [...a] });
  steps.push({ kind: "done", indices: [], array: [...a], note: "Sorted ✓" });
  return steps;
}

export function quickSort(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  const part = (lo: number, hi: number): number => {
    const pivot = a[hi];
    steps.push({
      kind: "pivot", indices: [hi], array: [...a],
      pointers: { low: lo, high: hi, pivot: hi }, note: `Pivot = a[${hi}] = ${pivot}`,
    });
    let i = lo;
    for (let j = lo; j < hi; j++) {
      steps.push({
        kind: "compare", indices: [j, hi], array: [...a],
        pointers: { low: lo, high: hi, i, j, pivot: hi },
        note: `Is a[${j}]=${a[j]} < pivot ${pivot}?`,
      });
      if (a[j] < pivot) {
        if (i !== j) {
          swap(a, i, j);
          steps.push({
            kind: "swap", indices: [i, j], array: [...a],
            pointers: { low: lo, high: hi, i, j, pivot: hi }, note: `Move ${a[i]} into left partition`,
          });
        }
        i++;
      }
    }
    swap(a, i, hi);
    steps.push({
      kind: "swap", indices: [i, hi], array: [...a],
      pointers: { low: lo, high: hi, i, pivot: i }, note: `Place pivot at ${i}`,
    });
    return i;
  };
  const sort = (lo: number, hi: number) => {
    if (lo >= hi) {
      if (lo === hi) steps.push({ kind: "mark-sorted", indices: [lo], array: [...a] });
      return;
    }
    const p = part(lo, hi);
    steps.push({ kind: "mark-sorted", indices: [p], array: [...a] });
    sort(lo, p - 1);
    sort(p + 1, hi);
  };
  sort(0, a.length - 1);
  steps.push({ kind: "done", indices: [], array: [...a], note: "Sorted ✓" });
  return steps;
}

export interface AlgoMeta {
  id: AlgoId;
  name: string;
  best: string;
  avg: string;
  worst: string;
  space: string;
  stable: boolean;
  description: string;
  useCases: string[];
  pseudocode: string[];
  run: (input: number[]) => Step[];
}

export const ALGORITHMS: AlgoMeta[] = [
  {
    id: "bubble", name: "Bubble Sort",
    best: "O(n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true,
    description: "Repeatedly steps through the list, compares adjacent items, and swaps them if they're out of order. The largest unsorted element bubbles to the end each pass.",
    useCases: ["Teaching sorting fundamentals", "Tiny / nearly-sorted datasets"],
    pseudocode: [
      "for i from 0 to n-1:",
      "  for j from 0 to n-i-2:",
      "    if a[j] > a[j+1]:",
      "      swap(a[j], a[j+1])",
      "  mark a[n-i-1] as sorted",
    ],
    run: bubbleSort,
  },
  {
    id: "selection", name: "Selection Sort",
    best: "O(n²)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: false,
    description: "Finds the smallest remaining element and swaps it into place. Minimizes the number of writes — useful when write cost is high.",
    useCases: ["Flash memory writes", "Small embedded systems"],
    pseudocode: [
      "for i from 0 to n-1:",
      "  min = i",
      "  for j from i+1 to n-1:",
      "    if a[j] < a[min]: min = j",
      "  if min != i: swap(a[i], a[min])",
      "  mark a[i] as sorted",
    ],
    run: selectionSort,
  },
  {
    id: "insertion", name: "Insertion Sort",
    best: "O(n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true,
    description: "Builds the sorted list one element at a time by inserting each new item into its correct position. Excellent for small or nearly-sorted data and used as the base case in hybrid sorts.",
    useCases: ["Online streaming sort", "Small subarrays in Timsort / Introsort"],
    pseudocode: [
      "for i from 1 to n-1:",
      "  j = i",
      "  while j > 0 and a[j-1] > a[j]:",
      "    swap(a[j-1], a[j])",
      "    j = j - 1",
    ],
    run: insertionSort,
  },
  {
    id: "merge", name: "Merge Sort",
    best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(n)", stable: true,
    description: "Divide-and-conquer: split the array in half, sort each half recursively, then merge. Guarantees O(n log n) and is stable.",
    useCases: ["External sorting of large files", "Linked-list sorting", "Stable sorting at scale"],
    pseudocode: [
      "mergeSort(a, low, high):",
      "  if low >= high: return",
      "  mid = (low + high) / 2",
      "  mergeSort(a, low, mid)",
      "  mergeSort(a, mid+1, high)",
      "  merge(a, low, mid, high)",
      "",
      "merge(a, low, mid, high):",
      "  copy halves into L and R",
      "  while L and R have items:",
      "    pick smaller, write to a[k]; k++",
      "  copy any remaining items",
    ],
    run: mergeSort,
  },
  {
    id: "quick", name: "Quick Sort",
    best: "O(n log n)", avg: "O(n log n)", worst: "O(n²)", space: "O(log n)", stable: false,
    description: "Picks a pivot, partitions elements into less-than / greater-than groups, then recurses. Fast in practice and cache-friendly.",
    useCases: ["General-purpose in-memory sort", "Language standard libraries (with introsort fallback)"],
    pseudocode: [
      "quickSort(a, low, high):",
      "  if low >= high: return",
      "  p = partition(a, low, high)",
      "  quickSort(a, low, p-1)",
      "  quickSort(a, p+1, high)",
      "",
      "partition(a, low, high):",
      "  pivot = a[high]; i = low",
      "  for j from low to high-1:",
      "    if a[j] < pivot: swap(a[i], a[j]); i++",
      "  swap(a[i], a[high])",
      "  return i",
    ],
    run: quickSort,
  },
];
