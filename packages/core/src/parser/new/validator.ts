/**
 * Validator for the DSL AST
 * 
 * The validator performs semantic analysis on the AST, checking for logical errors
 * like undefined entities, invalid references, etc.
 */
import { DSLParsingError } from '../../errors';
import * as AST from './ast';
import { Position } from './token';

/**
 * Diagnostic interface for validation errors
 */
export interface Diagnostic {
  message: string;
  location: Position;
  filePath?: string;
  context?: string;
}

export class Validator {
  private diagnostics: Diagnostic[] = [];
  private filePath?: string;
  
  // Track declared names for validation
  private entityNames = new Set<string>();
  private viewNames = new Set<string>();
  private enumNames = new Set<string>();
  private entityFields = new Map<string, Set<string>>();
  
  // Valid built-in types
  private builtInTypes = new Set([
    'String', 'Text', 'Int', 'Float', 'Decimal', 'Boolean',
    'DateTime', 'Date', 'UUID', 'JSON', 'Password'
  ]);
  
  constructor(filePath?: string) {
    this.filePath = filePath;
  }
  
  /**
   * Validate an AST and return any diagnostics
   */
  validate(ast: AST.Program): Diagnostic[] {
    this.diagnostics = [];
    
    // First pass: collect all entity, enum, and view names
    this.collectDeclarations(ast);
    
    // Second pass: validate the declarations
    for (const decl of ast.declarations) {
      this.validateDeclaration(decl);
    }
    
    // Check for at least one entity
    if (this.entityNames.size === 0) {
      this.diagnostics.push({
        message: 'At least one entity declaration is required.',
        location: ast.location.start,
        filePath: this.filePath
      });
    }
    
    return this.diagnostics;
  }
  
  /**
   * First pass: collect all top-level declarations for cross-reference validation
   */
  private collectDeclarations(ast: AST.Program): void {
    for (const decl of ast.declarations) {
      switch (decl.type) {
        case 'EntityDeclaration':
          this.registerEntityName(decl.name.name, decl.name.location.start);
          
          // Collect field names for this entity
          const fieldNames = new Set<string>();
          for (const member of decl.members) {
            if (member.type === 'FieldDeclaration') {
              fieldNames.add(member.name.name);
            }
          }
          this.entityFields.set(decl.name.name, fieldNames);
          break;
          
        case 'ViewDeclaration':
          this.registerViewName(decl.name.name, decl.name.location.start);
          break;
          
        case 'EnumDeclaration':
          this.registerEnumName(decl.name.name, decl.name.location.start);
          break;
      }
    }
  }
  
  /**
   * Second pass: validate each declaration
   */
  private validateDeclaration(decl: AST.Declaration): void {
    switch (decl.type) {
      case 'EntityDeclaration':
        this.validateEntityDeclaration(decl);
        break;
        
      case 'ViewDeclaration':
        this.validateViewDeclaration(decl);
        break;
        
      case 'PageDeclaration':
        this.validatePageDeclaration(decl);
        break;
        
      case 'WorkflowDeclaration':
        this.validateWorkflowDeclaration(decl);
        break;
        
      case 'ConfigDeclaration':
        this.validateConfigDeclaration(decl);
        break;
        
      case 'EnumDeclaration':
        this.validateEnumDeclaration(decl);
        break;
    }
  }
  
  /**
   * Validate an entity declaration
   */
  private validateEntityDeclaration(entity: AST.EntityDeclaration): void {
    const entityName = entity.name.name;
    const fieldNames = new Set<string>();
    let hasPrimaryKey = false;
    
    // Validate each field
    for (const member of entity.members) {
      if (member.type === 'FieldDeclaration') {
        // Check for duplicate field names
        if (fieldNames.has(member.name.name)) {
          this.diagnostics.push({
            message: `Duplicate field name '${member.name.name}' in entity '${entityName}'`,
            location: member.name.location.start,
            filePath: this.filePath
          });
        } else {
          fieldNames.add(member.name.name);
        }
        
        // Validate field name format
        this.validateFieldName(member.name.name, member.name.location.start);
        
        // Validate field type
        this.validateFieldType(member.fieldType.typeName.name, entityName, member.name.name, member.fieldType.typeName.location.start);
        
        // Check for primary key attribute
        for (const attr of member.attributes) {
          if (attr.name === 'primaryKey') {
            hasPrimaryKey = true;
          }
          
          // Validate relation attribute
          if (attr.name === 'relation') {
            this.validateRelationAttribute(attr, entityName, member);
          }
        }
      }
    }
    
    // If no primary key exists, check if there's an id field
    if (!hasPrimaryKey && !fieldNames.has('id')) {
      this.diagnostics.push({
        message: `Entity '${entityName}' has no primary key field. Add 'id: UUID primaryKey' or mark another field with 'primaryKey'.`,
        location: entity.name.location.start,
        filePath: this.filePath
      });
    }
  }
  
  /**
   * Validate a field name
   */
  private validateFieldName(name: string, location: Position): void {
    // Field names should start with a letter or underscore and contain only letters, numbers, and underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      this.diagnostics.push({
        message: `Invalid field name: "${name}". Field names must start with a letter or underscore and contain only letters, numbers, and underscores.`,
        location,
        filePath: this.filePath
      });
    }
  }
  
  /**
   * Validate a field type
   */
  private validateFieldType(type: string, entityName: string, fieldName: string, location: Position): void {
    // Check if the type is a built-in type, registered entity, or enum
    if (!this.builtInTypes.has(type) && !this.entityNames.has(type) && !this.enumNames.has(type)) {
      this.diagnostics.push({
        message: `Unknown type '${type}' for field '${fieldName}' in entity '${entityName}'`,
        location,
        filePath: this.filePath
      });
    }
  }
  
  /**
   * Validate a relation attribute
   */
  private validateRelationAttribute(attr: AST.Attribute, entityName: string, field: AST.FieldDeclaration): void {
    // Check if the field type refers to a valid entity
    const fieldType = field.fieldType.typeName.name;
    
    if (!this.entityNames.has(fieldType)) {
      this.diagnostics.push({
        message: `Entity '${fieldType}' not found for relation '${field.name.name}' in entity '${entityName}'`,
        location: field.fieldType.typeName.location.start,
        filePath: this.filePath
      });
    }
    
    // Ensure relation has a name
    if (!attr.arguments || attr.arguments.length < 1) {
      this.diagnostics.push({
        message: `Relation attribute must have a name argument`,
        location: attr.location.start,
        filePath: this.filePath
      });
    } else {
      // Check that the first argument is a string
      const nameArg = attr.arguments[0];
      if (nameArg.type !== 'StringLiteral') {
        this.diagnostics.push({
          message: `Relation name must be a string`,
          location: nameArg.location.start,
          filePath: this.filePath
        });
      }
    }
  }
  
  /**
   * Validate a view declaration
   */
  private validateViewDeclaration(view: AST.ViewDeclaration): void {
    // Check that the referenced entity exists
    const entityName = view.from.name;
    
    if (!this.entityNames.has(entityName)) {
      this.diagnostics.push({
        message: `Entity '${entityName}' not found for view '${view.name.name}'`,
        location: view.from.location.start,
        filePath: this.filePath
      });
      return;
    }
    
    // Check that fields are properly defined
    for (const field of view.fields) {
      // If field has a type, validate it
      if (field.fieldType) {
        this.validateFieldType(
          field.fieldType.name, 
          view.name.name, 
          field.name.name, 
          field.fieldType.location.start
        );
      }
    }
  }
  
  /**
   * Validate a page declaration
   */
  private validatePageDeclaration(page: AST.PageDeclaration): void {
    let typeProperty: AST.Property | undefined;
    
    // Find the type property
    for (const prop of page.properties) {
      if (prop.key.name === 'type') {
        typeProperty = prop;
        break;
      }
    }
    
    // Check that page has a type property
    if (!typeProperty) {
      this.diagnostics.push({
        message: `Page '${page.name.name}' must have a 'type' property`,
        location: page.location.start,
        filePath: this.filePath
      });
      return;
    }
    
    // Check that type is a string and has a valid value
    if (typeProperty.value.type !== 'StringLiteral' && typeProperty.value.type !== 'Identifier') {
      this.diagnostics.push({
        message: `Page 'type' property must be a string or identifier`,
        location: typeProperty.value.location.start,
        filePath: this.filePath
      });
      return;
    }
    
    // If entity is specified, check that it exists
    if (page.entity) {
      const entityName = page.entity.name;
      
      if (!this.entityNames.has(entityName) && !this.viewNames.has(entityName)) {
        this.diagnostics.push({
          message: `Unknown entity or view '${entityName}' referenced in page '${page.name.name}'`,
          location: page.entity.location.start,
          filePath: this.filePath
        });
      }
    }
  }
  
  /**
   * Validate a workflow declaration
   */
  private validateWorkflowDeclaration(workflow: AST.WorkflowDeclaration): void {
    // Check for trigger property
    let triggerProperty: AST.Property | undefined;
    
    for (const prop of workflow.properties) {
      if (prop.key.name === 'trigger') {
        triggerProperty = prop;
        break;
      }
    }
    
    if (!triggerProperty) {
      this.diagnostics.push({
        message: `Workflow '${workflow.name.name}' must have a 'trigger' property`,
        location: workflow.location.start,
        filePath: this.filePath
      });
      return;
    }
    
    // Validate trigger object
    if (triggerProperty.value.type === 'ObjectLiteral') {
      const triggerObject = triggerProperty.value as AST.ObjectLiteral;
      
      // Check for event and entity properties
      let hasEvent = false;
      let entityName: string | undefined;
      
      for (const prop of triggerObject.properties) {
        if (prop.key.name === 'event') {
          hasEvent = true;
        } else if (prop.key.name === 'entity' && prop.value.type === 'Identifier') {
          entityName = (prop.value as AST.Identifier).name;
        }
      }
      
      if (!hasEvent) {
        this.diagnostics.push({
          message: `Workflow trigger must have an 'event' property`,
          location: triggerObject.location.start,
          filePath: this.filePath
        });
      }
      
      // If entity is specified, check that it exists
      if (entityName && !this.entityNames.has(entityName)) {
        this.diagnostics.push({
          message: `Unknown entity '${entityName}' referenced in workflow '${workflow.name.name}'`,
          location: triggerObject.location.start,
          filePath: this.filePath
        });
      }
    } else {
      this.diagnostics.push({
        message: `Workflow 'trigger' property must be an object`,
        location: triggerProperty.value.location.start,
        filePath: this.filePath
      });
    }
  }
  
  /**
   * Validate a config declaration
   */
  private validateConfigDeclaration(config: AST.ConfigDeclaration): void {
    // Validate auth config
    if (config.name.name === 'auth') {
      let providerProperty: AST.Property | undefined;
      let userEntityProperty: AST.Property | undefined;
      
      for (const prop of config.properties) {
        if (prop.key.name === 'provider') {
          providerProperty = prop;
        } else if (prop.key.name === 'userEntity') {
          userEntityProperty = prop;
        }
      }
      
      // Check for provider property
      if (!providerProperty) {
        this.diagnostics.push({
          message: `Auth config must have a 'provider' property`,
          location: config.location.start,
          filePath: this.filePath
        });
      }
      
      // If userEntity is specified, check that it exists
      if (userEntityProperty && userEntityProperty.value.type === 'Identifier') {
        const entityName = (userEntityProperty.value as AST.Identifier).name;
        
        if (!this.entityNames.has(entityName)) {
          this.diagnostics.push({
            message: `Unknown entity '${entityName}' referenced in auth config`,
            location: userEntityProperty.value.location.start,
            filePath: this.filePath
          });
        }
      }
    }
  }
  
  /**
   * Validate an enum declaration
   */
  private validateEnumDeclaration(enumDecl: AST.EnumDeclaration): void {
    const enumName = enumDecl.name.name;
    const valueNames = new Set<string>();
    
    // Check for at least one value
    if (enumDecl.values.length === 0) {
      this.diagnostics.push({
        message: `Enum '${enumName}' must have at least one value`,
        location: enumDecl.location.start,
        filePath: this.filePath
      });
      return;
    }
    
    // Check for duplicate values
    for (const value of enumDecl.values) {
      if (valueNames.has(value.name.name)) {
        this.diagnostics.push({
          message: `Duplicate enum value '${value.name.name}' in enum '${enumName}'`,
          location: value.name.location.start,
          filePath: this.filePath
        });
      } else {
        valueNames.add(value.name.name);
      }
      
      // Validate enum value name format
      this.validateEnumValueName(value.name.name, value.name.location.start);
    }
  }
  
  /**
   * Validate an enum value name
   */
  private validateEnumValueName(name: string, location: Position): void {
    // Enum values should be uppercase with underscores
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
      this.diagnostics.push({
        message: `Invalid enum value name: "${name}". Enum values should be uppercase with underscores.`,
        location,
        filePath: this.filePath
      });
    }
  }
  
  /**
   * Register an entity name and check for duplicates
   */
  private registerEntityName(name: string, location: Position): void {
    if (this.entityNames.has(name) || this.viewNames.has(name) || this.enumNames.has(name)) {
      this.diagnostics.push({
        message: `Duplicate declaration name '${name}'`,
        location,
        filePath: this.filePath
      });
    } else {
      this.entityNames.add(name);
    }
  }
  
  /**
   * Register a view name and check for duplicates
   */
  private registerViewName(name: string, location: Position): void {
    if (this.entityNames.has(name) || this.viewNames.has(name) || this.enumNames.has(name)) {
      this.diagnostics.push({
        message: `Duplicate declaration name '${name}'`,
        location,
        filePath: this.filePath
      });
    } else {
      this.viewNames.add(name);
    }
  }
  
  /**
   * Register an enum name and check for duplicates
   */
  private registerEnumName(name: string, location: Position): void {
    if (this.entityNames.has(name) || this.viewNames.has(name) || this.enumNames.has(name)) {
      this.diagnostics.push({
        message: `Duplicate declaration name '${name}'`,
        location,
        filePath: this.filePath
      });
    } else {
      this.enumNames.add(name);
    }
  }
}

/**
 * Validate an AST and return any diagnostics
 */
export function validate(ast: AST.Program, filePath?: string): Diagnostic[] {
  const validator = new Validator(filePath);
  return validator.validate(ast);
}
