export interface RawCSVRow {
  account_number?: string;
  debtor_name?: string;
  phone_number?: string;
  balance?: string;
  status?: string;
  client_name?: string;
  [key: string]: string | undefined;
}

export interface Account {
  account_number: string;
  debtor_name: string;
  phone_number: string | null;
  balance: number;
  status: string;
  client_name: string;
}
