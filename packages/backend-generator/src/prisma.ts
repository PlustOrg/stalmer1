// Generates a Prisma schema from IREntity[]
import { IREntity, IRField, IRRelation } from '@stalmer1/core';

/**
 * Generates a Prisma schema from the entities defined in the DSL
 * @param entities - The list of entities from the IR
 * @param dbType - The database type (sqlite or postgresql)
 * @returns A string containing the Prisma schema
 */
export function generatePrismaSchema(entities: IREntity[], dbType: 'sqlite' | 'postgresql' = 'sqlite'): string {
  // Generate the Prisma schema header
  let schema = `// This file is generated - DO NOT EDIT\n\n`;
  
  // Generator section
  schema += `generator client {\n  provider = "prisma-client-js"\n}\n\n`;
  
  // Datasource section based on DB type
  schema += `datasource db {\n`;
  schema += `  provider = "${dbType}"\n`;
  
  if (dbType === 'sqlite') {
    schema += `  url      = "file:./dev.db"\n`;
  } else {
    schema += `  url      = env("DATABASE_URL")\n`;
  }
  schema += `}\n\n`;
  
  // Generate enums
  // TODO: Implement enum handling from IR
  
  // Generate models from entities
  for (const entity of entities) {
    schema += `model ${entity.name} {\n`;
    
    // Process regular fields
    for (const field of entity.fields || []) {
      schema += `  ${generateFieldDefinition(field)}\n`;
    }
    
    // Process relations
    if (entity.relations && entity.relations.length > 0) {
      schema += '\n  // Relations\n';
      for (const relation of entity.relations) {
        schema += `  ${generateRelationDefinition(relation)}\n`;
      }
    }
    
    // Add indexes, unique constraints, etc.
    const indexes = generateIndexes(entity);
    if (indexes) {
      schema += `\n  ${indexes}\n`;
    }
    
    schema += `}\n\n`;
  }
  
  return schema;
}

/**
 * Generates a Prisma field definition from an IR field
 * @param field - The IR field
 * @returns A string containing the Prisma field definition
 */
function generateFieldDefinition(field: IRField): string {
  const prismaType = mapType(field.type);
  let fieldDef = `${field.name} ${prismaType}`;
  
  // Add field constraints
  if (field.primaryKey) {
    fieldDef += ' @id';
    
    // Auto-increment for Int primary keys
    if (field.type.toLowerCase() === 'int') {
      fieldDef += ' @default(autoincrement())';
    } else if (field.type.toLowerCase() === 'uuid') {
      fieldDef += ' @default(uuid())';
    }
  }
  
  if (field.unique && !field.primaryKey) {
    fieldDef += ' @unique';
  }
  
  // Handle optional fields
  if (field.optional) {
    fieldDef += '?';
  }
  
  // Add special type attributes
  if (field.isLongText) {
    fieldDef += ' @db.Text';
  } else if (field.isDecimal) {
    fieldDef += ' @db.Decimal(10, 2)'; // Default precision/scale
  } else if (field.isDateOnly) {
    fieldDef += ' @db.Date';
  }
  
  // Add default values
  if (field.default !== undefined && !field.primaryKey) {
    if (typeof field.default === 'string') {
      if (field.type.toLowerCase() === 'datetime' && field.default === 'now') {
        fieldDef += ' @default(now())';
      } else {
        fieldDef += ` @default("${field.default}")`;
      }
    } else {
      fieldDef += ` @default(${field.default})`;
    }
  }
  
  // Special handling for Password type
  if (field.type.toLowerCase() === 'password') {
    fieldDef += ' /// @password';  // Custom annotation for password fields
  }
  
  // Add DB-specific type mapping if needed
  if (field.type.toLowerCase() === 'text') {
    fieldDef += ' @db.Text';
  } else if (field.type.toLowerCase() === 'date') {
    fieldDef += ' @db.Date';
  } else if (field.type.toLowerCase() === 'uuid') {
    fieldDef += ' @db.Uuid';
  }
  
  // Add validator comments if present
  if (field.validate) {
    fieldDef += ` /// @validate(${field.validate})`;
  }
  
  // Add readonly comment if field is readonly
  if (field.readonly) {
    fieldDef += ' /// @readonly';
  }
  
  return fieldDef;
}

/**
 * Generates a Prisma relation definition from an IR relation
 * @param relation - The IR relation
 * @returns A string containing the Prisma relation definition
 */
function generateRelationDefinition(relation: IRRelation): string {
  const isArray = relation.type === 'one-to-many';
  let relDef = `${relation.field} ${relation.target}${isArray ? '[]' : ''}`;
  
  // Add relation directive for the field
  // Since we don't have explicit relation name in IRRelation, we'll construct one
  const relationName = `${relation.target}To${relation.field.charAt(0).toUpperCase() + relation.field.slice(1)}`;
  relDef += ` @relation("${relationName}")`;
  
  return relDef;
}

/**
 * Generates Prisma indexes and constraints from an entity
 * @param entity - The IR entity
 * @returns A string containing the Prisma indexes and constraints
 */
function generateIndexes(entity: IREntity): string | null {
  const indexes: string[] = [];
  
  // Generate indexes for foreign key fields
  if (entity.relations) {
    for (const relation of entity.relations) {
      if (relation.type === 'many-to-one') {
        // For many-to-one relationships, we typically want an index on the foreign key field
        indexes.push(`@@index([${relation.field}])`);
      }
    }
  }
  
  // Generate compound unique constraints if defined
  // TODO: Implement compound unique constraints
  
  return indexes.length > 0 ? indexes.join('\n  ') : null;
}

/**
 * Maps DSL types to Prisma types
 * @param type - The DSL type
 * @returns The corresponding Prisma type
 */
function mapType(type: string): string {
  const lowerType = type.toLowerCase();
  switch (lowerType) {
    case 'string':
      return 'String';
    case 'text':
      return 'String';
    case 'int':
      return 'Int';
    case 'float':
      return 'Float';
    case 'decimal':
      return 'Decimal';
    case 'boolean':
      return 'Boolean';
    case 'datetime':
      return 'DateTime';
    case 'date':
      return 'DateTime';
    case 'uuid':
      return 'String';
    case 'json':
      return 'Json';
    case 'password':
      return 'String';
    default:
      // Assume it's an enum or unrecognized type, default to String
      return type;
  }
}
