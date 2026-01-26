import * as schema from "../db/schema";
import { PgTable } from "drizzle-orm/pg-core";

// Define a type for the company
export type Company = "ONK_GROUP" | "ANT_SAVY";

/**
 * Helper to get the correct table based on the user's company.
 * @param tableName The base name of the table (e.g., "suppliers", "materials")
 * @param company The company identifier
 * @returns The table object to use for queries
 */
export const getTable = (tableName: string, company?: string | null) => {
  const normalized = (company || "").toUpperCase().trim();
  if (normalized === "ANT_SAVY") {
    const savyName = `${tableName}Savy`;
    // Check if the savy table exists in schema
    if (savyName in schema) {
      return (schema as any)[savyName];
    }
    throw new Error(`Table ${savyName} not found in schema`);
  }
  if (normalized === "ONK_GROUP") {
    if (tableName in schema) {
      return (schema as any)[tableName];
    }
    throw new Error(`Table ${tableName} not found in schema`);
  }
  throw new Error(`Unknown or missing company for table resolution: ${company}`);
};

/**
 * Helper to determine company from email domain
 */
export const getCompanyFromEmail = (email: string): Company => {
  const e = email.toLowerCase();
  if (e.endsWith("@antsavy.co.uk") || e.endsWith("@antsavy.com")) {
    return "ANT_SAVY";
  }
  return "ONK_GROUP";
};
