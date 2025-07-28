/**
 * AST (Abstract Syntax Tree) definitions for the DSL parser
 * 
 * This file defines the interfaces for the AST nodes that represent
 * the structure of the DSL code.
 */
import { Position } from './token';

/**
 * Base interface for all AST nodes
 */
export interface ASTNode {
  type: string;
  location: {
    start: Position;
    end: Position;
  };
}

/**
 * The root node representing the entire DSL file
 */
export interface Program extends ASTNode {
  type: 'Program';
  declarations: Declaration[];
}

/**
 * Union type for all top-level declarations
 */
export type Declaration = 
  | EntityDeclaration
  | ViewDeclaration 
  | PageDeclaration
  | WorkflowDeclaration
  | ConfigDeclaration
  | EnumDeclaration;

/**
 * Entity declaration (data model definition)
 */
export interface EntityDeclaration extends ASTNode {
  type: 'EntityDeclaration';
  name: Identifier;
  members: EntityMember[];
}

/**
 * Member declarations within an entity
 */
export type EntityMember = FieldDeclaration;

/**
 * Field declaration within an entity
 */
export interface FieldDeclaration extends ASTNode {
  type: 'FieldDeclaration';
  name: Identifier;
  fieldType: TypeAnnotation;
  attributes: Attribute[];
}

/**
 * Type annotation for a field
 */
export interface TypeAnnotation extends ASTNode {
  type: 'TypeAnnotation';
  typeName: Identifier;
  isArray: boolean;
}

/**
 * Field attribute (primaryKey, unique, etc.)
 */
export interface Attribute extends ASTNode {
  type: 'Attribute';
  name: string;
  arguments?: Expression[];
}

/**
 * View declaration (derived data model)
 */
export interface ViewDeclaration extends ASTNode {
  type: 'ViewDeclaration';
  name: Identifier;
  from: Identifier;
  fields: ViewField[];
  properties: Property[];
}

/**
 * Field within a view declaration
 */
export interface ViewField extends ASTNode {
  type: 'ViewField';
  name: Identifier;
  fieldType?: Identifier;
  expression: string;
}

/**
 * Page declaration (UI definition)
 */
export interface PageDeclaration extends ASTNode {
  type: 'PageDeclaration';
  name: Identifier;
  properties: Property[];
  entity?: Identifier;
}

/**
 * Workflow declaration (business process)
 */
export interface WorkflowDeclaration extends ASTNode {
  type: 'WorkflowDeclaration';
  name: Identifier;
  properties: Property[];
}

/**
 * Config declaration (application settings)
 */
export interface ConfigDeclaration extends ASTNode {
  type: 'ConfigDeclaration';
  name: Identifier;
  properties: Property[];
}

/**
 * Enum declaration (value set)
 */
export interface EnumDeclaration extends ASTNode {
  type: 'EnumDeclaration';
  name: Identifier;
  values: EnumValue[];
}

/**
 * Value within an enum declaration
 */
export interface EnumValue extends ASTNode {
  type: 'EnumValue';
  name: Identifier;
}

/**
 * Property within a declaration (key-value pair)
 */
export interface Property extends ASTNode {
  type: 'Property';
  key: Identifier;
  value: Expression;
}

/**
 * Union type for all expression types
 */
export type Expression = 
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | ArrayLiteral
  | ObjectLiteral
  | Identifier
  | QualifiedIdentifier
  | FunctionCall;

/**
 * String literal expression
 */
export interface StringLiteral extends ASTNode {
  type: 'StringLiteral';
  value: string;
}

/**
 * Number literal expression
 */
export interface NumberLiteral extends ASTNode {
  type: 'NumberLiteral';
  value: number;
}

/**
 * Boolean literal expression
 */
export interface BooleanLiteral extends ASTNode {
  type: 'BooleanLiteral';
  value: boolean;
}

/**
 * Array literal expression
 */
export interface ArrayLiteral extends ASTNode {
  type: 'ArrayLiteral';
  elements: Expression[];
}

/**
 * Object literal expression
 */
export interface ObjectLiteral extends ASTNode {
  type: 'ObjectLiteral';
  properties: Property[];
}

/**
 * Identifier (variable name, type name, etc.)
 */
export interface Identifier extends ASTNode {
  type: 'Identifier';
  name: string;
}

/**
 * Qualified identifier (dotted path)
 */
export interface QualifiedIdentifier extends ASTNode {
  type: 'QualifiedIdentifier';
  parts: string[];
}

/**
 * Function call expression
 */
export interface FunctionCall extends ASTNode {
  type: 'FunctionCall';
  callee: Identifier;
  arguments: Expression[];
}
