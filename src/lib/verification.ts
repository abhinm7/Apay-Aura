// Buying the verified badge. Shared by the client form and the API route.

export const VERIFY_FEE = 24_999;

export const OCCUPATIONS = [
  { value: "employed", label: "Employed" },
  { value: "salaried", label: "Salaried" },
  { value: "student", label: "Student" },
] as const;

export type Occupation = (typeof OCCUPATIONS)[number]["value"];

export const isOccupation = (v: string): v is Occupation => OCCUPATIONS.some((o) => o.value === v);

export const MAX_ADDRESS = 300;
export const MAX_INCOME = 100_000_000;
