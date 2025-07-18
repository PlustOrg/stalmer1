// Core IR definitions for Stalmer1
// See ARCHITECTURE.md#3.2 for full specification

export interface IApp {
  name: string;
  entities: IREntity[];
  pages: IRPage[];
  config?: IRConfig;
  workflows?: IRWorkflow[];
}

export interface IREntity {
  name: string;
  fields: IRField[];
  relations?: IRRelation[];
}

export interface IRField {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  default?: string | number | boolean | null;
  primaryKey?: boolean;
  optional?: boolean;
  readonly?: boolean;
  validate?: string;
  isPassword?: boolean;
  relation?: string; // For relations defined on fields
  // Enhanced type handling
  isLongText?: boolean; // For Text type
  isDecimal?: boolean; // For Decimal type
  isDateOnly?: boolean; // For Date-only type
  // Validation properties
  min?: number;
  max?: number;
  pattern?: string;
}

export interface IRRelation {
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  target: string;
  field: string;
  relationName?: string; // Name of the relation for Prisma
}

export interface IRPage {
  name: string;
  type: 'table' | 'form' | 'details' | 'dashboard' | 'custom';
  entity?: string; // Optional for dashboard/custom pages
  route: string;
  permissions?: string[];
  props?: Record<string, string | number | boolean | null | string[] | Record<string, unknown>>; // For columns, fields, actions, filters, etc.
  // Additional properties used in tests
  columns?: Array<{ field: string; label: string }>;
  title?: string;
}

export interface IRConfig {
  db?: 'sqlite' | 'postgresql';
  auth?: {
    provider: 'jwt' | 'clerk' | 'auth0';
    userEntity?: string;
    roles?: string; // Reference to an enum
    guards?: Record<string, string[]>;
  };
  integrations?: {
    email?: {
      provider: string;
      apiKey: string;
      defaultFrom?: string;
    };
    monitoring?: {
      provider: string;
      dsn: string;
    };
    // payments?: {
    //   provider: string;
    //   apiKey: string;
    // };
  };
  enums?: Record<string, string[]>; // To store parsed enums
}

export interface IRWorkflow {
  name: string;
  trigger: {
    event: string;
    entity: string;
  };
  steps: IRWorkflowStep[];
}

export interface IRWorkflowStep {
  action: string;
  inputs: Record<string, string | number | boolean | null | string[] | Record<string, unknown>>;
}