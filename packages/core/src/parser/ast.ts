/**
 * AST (Abstract Syntax Tree) definitions for the DSL parser
 * 
 * This file defines the interfaces for the AST nodes that represent
 * the structure of the DSL code. The AST is a literal, syntactic
 * representation of the code that can be used by tools like formatters,
 * linters, and language servers.
 */

export interface Position {
  line: number;   // 1-based line number
  column: number; // 1-based column number
}

export interface NodeBase {
  kind: string;
  position: {
    start: Position;
    end: Position;
  };
}

export interface SourceFileNode extends NodeBase {
  kind: 'SourceFile';
  statements: StatementNode[];
}

export type StatementNode = 
  | EntityDeclarationNode
  | ViewDeclarationNode
  | PageDeclarationNode
  | WorkflowDeclarationNode
  | ConfigDeclarationNode
  | EnumDeclarationNode;

export interface EntityDeclarationNode extends NodeBase {
  kind: 'EntityDeclaration';
  name: IdentifierNode;
  members: EntityMemberNode[];
}

export interface ViewDeclarationNode extends NodeBase {
  kind: 'ViewDeclaration';
  name: IdentifierNode;
  fromEntity: IdentifierNode;
  fields: ViewFieldNode[];
  properties: PropertyNode[];
}

export interface ViewFieldNode extends NodeBase {
  kind: 'ViewField';
  name: IdentifierNode;
  expression: string;
}

export interface PageDeclarationNode extends NodeBase {
  kind: 'PageDeclaration';
  name: IdentifierNode;
  entity: IdentifierNode;
  properties: PropertyNode[];
}

export interface WorkflowDeclarationNode extends NodeBase {
  kind: 'WorkflowDeclaration';
  name: IdentifierNode;
  properties: PropertyNode[];
}

export interface ConfigDeclarationNode extends NodeBase {
  kind: 'ConfigDeclaration';
  name: IdentifierNode;
  properties: PropertyNode[];
}

export interface EnumDeclarationNode extends NodeBase {
  kind: 'EnumDeclaration';
  name: IdentifierNode;
  values: EnumValueNode[];
}

export interface EnumValueNode extends NodeBase {
  kind: 'EnumValue';
  name: IdentifierNode;
}

export type EntityMemberNode = FieldDeclarationNode;

export interface FieldDeclarationNode extends NodeBase {
  kind: 'FieldDeclaration';
  name: IdentifierNode;
  type: TypeNode;
  attributes: AttributeNode[];
}

export interface TypeNode extends NodeBase {
  kind: 'Type';
  name: string;
  isArray: boolean;
}

export interface AttributeNode extends NodeBase {
  kind: 'Attribute';
  name: string;
  arguments?: ValueNode[];
}

export interface PropertyNode extends NodeBase {
  kind: 'Property';
  name: string;
  value: ValueNode;
}

export type ValueNode =
  | StringLiteralNode
  | NumberLiteralNode
  | BooleanLiteralNode
  | IdentifierNode
  | ArrayLiteralNode
  | ObjectLiteralNode;

export interface StringLiteralNode extends NodeBase {
  kind: 'StringLiteral';
  value: string;
}

export interface NumberLiteralNode extends NodeBase {
  kind: 'NumberLiteral';
  value: number;
}

export interface BooleanLiteralNode extends NodeBase {
  kind: 'BooleanLiteral';
  value: boolean;
}

export interface IdentifierNode extends NodeBase {
  kind: 'Identifier';
  name: string;
}

export interface ArrayLiteralNode extends NodeBase {
  kind: 'ArrayLiteral';
  elements: ValueNode[];
}

export interface ObjectLiteralNode extends NodeBase {
  kind: 'ObjectLiteral';
  properties: Record<string, ValueNode>;
}
