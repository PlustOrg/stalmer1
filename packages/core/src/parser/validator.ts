/**
 * Validator for the DSL AST
 * 
 * The validator traverses the AST produced by the parser and checks for logical errors.
 * It collects all errors it finds into an array of diagnostics rather than throwing on the first one.
 */
import { DSLParsingError } from '../errors';
import * as AST from './ast';

export interface Diagnostic {
  message: string;
  line: number;
  column: number;
  filePath?: string;
  context?: string;
}

/**
 * Validate an AST for semantic correctness
 */
export function validate(ast: AST.SourceFileNode, filePath?: string): Diagnostic[] {
  const validator = new Validator(filePath);
  return validator.validate(ast);
}

class Validator {
  private diagnostics: Diagnostic[] = [];
  private filePath?: string;
  
  // For tracking entity and field names to detect duplicates
  private entityNames = new Set<string>();
  private viewNames = new Set<string>();
  private enumNames = new Set<string>();
  private entityFields = new Map<string, Set<string>>();
  
  // Valid field types
  private validBuiltInTypes = new Set([
    'String', 'Text', 'Int', 'Float', 'Decimal', 'Boolean', 
    'DateTime', 'Date', 'UUID', 'JSON', 'Password'
  ]);
  
  constructor(filePath?: string) {
    this.filePath = filePath;
  }
  
  validate(ast: AST.SourceFileNode): Diagnostic[] {
    this.diagnostics = [];
    
    // First pass: collect all entity, view, and enum names
    for (const statement of ast.statements) {
      if (statement.kind === 'EntityDeclaration') {
        this.registerEntityName(statement.name.name, statement.name);
      } else if (statement.kind === 'ViewDeclaration') {
        this.registerViewName(statement.name.name, statement.name);
      } else if (statement.kind === 'EnumDeclaration') {
        this.registerEnumName(statement.name.name, statement.name);
      }
    }
    
    // Second pass: validate individual statements
    for (const statement of ast.statements) {
      this.validateStatement(statement);
    }
    
    return this.diagnostics;
  }
  
  private validateStatement(statement: AST.StatementNode): void {
    switch (statement.kind) {
      case 'EntityDeclaration':
        this.validateEntityDeclaration(statement);
        break;
      case 'ViewDeclaration':
        this.validateViewDeclaration(statement);
        break;
      case 'PageDeclaration':
        this.validatePageDeclaration(statement);
        break;
      case 'ConfigDeclaration':
        this.validateConfigDeclaration(statement);
        break;
      case 'EnumDeclaration':
        this.validateEnumDeclaration(statement);
        break;
    }
  }
  
  private validateEntityDeclaration(entity: AST.EntityDeclarationNode): void {
    const entityName = entity.name.name;
    
    // Create a set to track field names in this entity
    const fieldNames = new Set<string>();
    
    // Validate each field
    for (const member of entity.members) {
      if (member.kind === 'FieldDeclaration') {
        this.validateFieldDeclaration(member, entityName, fieldNames);
      }
    }
    
    // Store field names for this entity for later reference
    this.entityFields.set(entityName, fieldNames);
  }
  
  private validateFieldDeclaration(field: AST.FieldDeclarationNode, entityName: string, fieldNames: Set<string>): void {
    const fieldName = field.name.name;
    
    // Check for duplicate field names
    if (fieldNames.has(fieldName)) {
      this.reportError(
        `Duplicate field name '${fieldName}' in entity '${entityName}'`,
        field.name.position.start.line,
        field.name.position.start.column
      );
    } else {
      fieldNames.add(fieldName);
    }
    
    // Check field type
    const typeName = field.type.name;
    
    // Type is either a built-in type, an entity, or an enum
    if (!this.validBuiltInTypes.has(typeName) && 
        !this.entityNames.has(typeName) && 
        !this.enumNames.has(typeName)) {
      this.reportError(
        `Unknown type '${typeName}' for field '${fieldName}' in entity '${entityName}'`,
        field.type.position.start.line,
        field.type.position.start.column
      );
    }
    
    // Check for relation directive and validate it
    const relationAttr = field.attributes.find(attr => attr.name === 'relation');
    if (relationAttr && relationAttr.arguments && relationAttr.arguments.length > 0) {
      this.validateRelationField(field, relationAttr, entityName);
    }
  }
  
  private validateRelationField(field: AST.FieldDeclarationNode, relationAttr: AST.AttributeNode, entityName: string): void {
    const targetEntityType = field.type.name;
    
    // Check that the target entity exists
    if (!this.entityNames.has(targetEntityType)) {
      this.reportError(
        `Entity '${targetEntityType}' not found for relation '${field.name.name}' in entity '${entityName}'`,
        field.type.position.start.line,
        field.type.position.start.column
      );
    }
  }
  
  private validateViewDeclaration(view: AST.ViewDeclarationNode): void {
    const viewName = view.name.name;
    
    // Validate that the referenced entity exists
    const fromEntity = view.fromEntity.name;
    if (!this.entityNames.has(fromEntity)) {
      this.reportError(
        `Entity '${fromEntity}' not found for view '${viewName}'`,
        view.fromEntity.position.start.line,
        view.fromEntity.position.start.column
      );
    }
    
    // Validate fields
    for (const field of view.fields) {
      // Could validate field expressions if needed
    }
    
    // Validate that required properties are provided
    let hasFromProperty = false;
    
    for (const property of view.properties) {
      if (property.name === 'from') {
        hasFromProperty = true;
        if (property.value.kind === 'Identifier') {
          const entityName = property.value.name;
          if (!this.entityNames.has(entityName)) {
            this.reportError(
              `Unknown entity '${entityName}' referenced in view '${viewName}'`,
              property.value.position.start.line,
              property.value.position.start.column
            );
          }
        }
      }
    }
    
    if (!hasFromProperty) {
      this.reportError(
        `View '${viewName}' is missing required 'from' property`,
        view.position.start.line,
        view.position.start.column
      );
    }
  }
  
  private validatePageDeclaration(page: AST.PageDeclarationNode): void {
    const pageName = page.name.name;
    
    // Check that required properties are provided
    let hasEntityProperty = false;
    let hasTypeProperty = false;
    
    for (const property of page.properties) {
      if (property.name === 'entity') {
        hasEntityProperty = true;
        if (property.value.kind === 'Identifier') {
          const entityName = property.value.name;
          if (!this.entityNames.has(entityName) && !this.viewNames.has(entityName)) {
            this.reportError(
              `Unknown entity or view '${entityName}' referenced in page '${pageName}'`,
              property.value.position.start.line,
              property.value.position.start.column
            );
          }
        }
      } else if (property.name === 'type') {
        hasTypeProperty = true;
      }
    }
    
    if (!hasEntityProperty) {
      this.reportError(
        `Page '${pageName}' is missing required 'entity' property`,
        page.position.start.line,
        page.position.start.column
      );
    }
    
    if (!hasTypeProperty) {
      this.reportError(
        `Page '${pageName}' is missing required 'type' property`,
        page.position.start.line,
        page.position.start.column
      );
    }
  }
  
  private validateConfigDeclaration(config: AST.ConfigDeclarationNode): void {
    // Validate auth config
    if (config.name.name === 'auth') {
      let hasUserEntity = false;
      
      for (const property of config.properties) {
        if (property.name === 'userEntity') {
          hasUserEntity = true;
          if (property.value.kind === 'Identifier' || property.value.kind === 'StringLiteral') {
            const entityName = property.value.kind === 'Identifier' ? 
                                property.value.name : 
                                property.value.value;
            if (!this.entityNames.has(entityName)) {
              this.reportError(
                `Unknown entity '${entityName}' referenced as userEntity in auth config`,
                property.value.position.start.line,
                property.value.position.start.column
              );
            }
          }
        }
      }
      
      if (!hasUserEntity) {
        this.reportError(
          `Auth config is missing required 'userEntity' property`,
          config.position.start.line,
          config.position.start.column
        );
      }
    }
  }
  
  private validateEnumDeclaration(enumDecl: AST.EnumDeclarationNode): void {
    const enumName = enumDecl.name.name;
    
    // Check for duplicate enum values
    const valueNames = new Set<string>();
    
    for (const value of enumDecl.values) {
      const valueName = value.name.name;
      
      if (valueNames.has(valueName)) {
        this.reportError(
          `Duplicate enum value '${valueName}' in enum '${enumName}'`,
          value.position.start.line,
          value.position.start.column
        );
      } else {
        valueNames.add(valueName);
      }
    }
  }
  
  private registerEntityName(name: string, node: AST.IdentifierNode): void {
    if (this.entityNames.has(name)) {
      this.reportError(
        `Duplicate entity name '${name}'`,
        node.position.start.line,
        node.position.start.column
      );
    } else {
      this.entityNames.add(name);
    }
  }
  
  private registerViewName(name: string, node: AST.IdentifierNode): void {
    if (this.viewNames.has(name) || this.entityNames.has(name)) {
      this.reportError(
        `Duplicate view name '${name}' or conflicts with an entity name`,
        node.position.start.line,
        node.position.start.column
      );
    } else {
      this.viewNames.add(name);
    }
  }
  
  private registerEnumName(name: string, node: AST.IdentifierNode): void {
    if (this.enumNames.has(name)) {
      this.reportError(
        `Duplicate enum name '${name}'`,
        node.position.start.line,
        node.position.start.column
      );
    } else {
      this.enumNames.add(name);
    }
  }
  
  private reportError(message: string, line: number, column: number, context?: string): void {
    this.diagnostics.push({
      message,
      line,
      column,
      filePath: this.filePath,
      context
    });
  }
}
