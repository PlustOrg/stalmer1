/**
 * IR Builder for the DSL
 * 
 * The IR Builder converts the validated AST into an Intermediate Representation (IR)
 * that is optimized for code generation. The IR is a semantic model of the application,
 * not a syntactic representation like the AST.
 */
import { IApp, IREntity, IRField, IRRelation, IRView, IRViewField, IRPage, IRConfig } from '../ir';
import * as AST from './ast';

/**
 * Build IR from a validated AST
 */
export function buildIR(ast: AST.SourceFileNode): IApp {
  const builder = new IRBuilder();
  return builder.buildApp(ast);
}

class IRBuilder {
  private app: IApp = {
    name: 'DefaultApp',
    entities: [],
    pages: [],
    config: {}
  };

  buildApp(ast: AST.SourceFileNode): IApp {
    this.app = {
      name: 'DefaultApp',
      entities: [],
      views: [],
      pages: [],
      workflows: [],
      config: {}
    };
    
    // Process all declarations in the AST
    for (const statement of ast.statements) {
      if (statement.kind === 'EntityDeclaration') {
        this.app.entities.push(this.buildEntity(statement));
      } else if (statement.kind === 'ViewDeclaration') {
        if (!this.app.views) this.app.views = [];
        this.app.views.push(this.buildView(statement));
      } else if (statement.kind === 'PageDeclaration') {
        this.app.pages.push(this.buildPage(statement));
      } else if (statement.kind === 'ConfigDeclaration') {
        if (!this.app.config) this.app.config = {};
        this.processConfig(statement);
      } else if (statement.kind === 'EnumDeclaration') {
        if (!this.app.config) this.app.config = {};
        if (!this.app.config.enums) this.app.config.enums = {};
        const enumDef = this.buildEnum(statement);
        this.app.config.enums[enumDef.name] = enumDef.values;
      }
    }
    
    return this.app;
  }

  private buildEnum(node: AST.EnumDeclarationNode): { name: string; values: string[] } {
    return {
      name: node.name.name,
      values: node.values.map(val => val.name.name),
    };
  }

  buildEntity(node: AST.EntityDeclarationNode): IREntity {
    const entity: IREntity = {
      name: node.name.name,
      fields: [],
      relations: []
    };
    
    // Process all members first
    for (const member of node.members) {
      if (member.kind === 'FieldDeclaration') {
        // Check if this is a relation field
        const relationAttr = member.attributes.find(attr => attr.name === 'relation');
        
        if (relationAttr) {
          // Add as both field and relation
          const field = this.buildField(member);
          entity.fields.push(field);
          
          // Add relation information
          if (entity.relations) {
            const relationType = member.type.isArray ? 'one-to-many' : 'many-to-one';
            
            const relation: IRRelation = {
              type: relationType,
              target: member.type.name,
              field: member.name.name,
            };
            
            // Extract the relation name if provided
            if (relationAttr.arguments && relationAttr.arguments.length > 0) {
              const nameArg = relationAttr.arguments.find(arg => 
                arg.kind === 'StringLiteral'
              );
              
              if (nameArg && nameArg.kind === 'StringLiteral') {
                relation.relationName = nameArg.value;
              }
            }
            
            entity.relations.push(relation);
          }
        } else {
          // Regular field
          const field = this.buildField(member);
          entity.fields.push(field);
        }
      }
    }
    
    // Check if there's a primary key field already
    const hasPrimaryKey = entity.fields.some(field => field.primaryKey);
    
    // Auto-add an 'id' field if no primary key exists
    if (!hasPrimaryKey && !entity.fields.some(field => field.name === 'id')) {
      entity.fields.unshift({
        name: 'id',
        type: 'UUID',
        primaryKey: true
      });
    }
    
    return entity;
  }

  buildField(node: AST.FieldDeclarationNode): IRField {
    const field: IRField = {
      name: node.name.name,
      type: node.type.name
    };
    
    // Mark array types
    if (node.type.isArray) {
      field.type = `${node.type.name}[]`;
    }

    // Handle special field types
    if (node.type.name === 'Password') {
      field.isPassword = true;
      field.type = 'String'; // Internally represented as String
    } else if (node.type.name === 'Text') {
      field.type = 'String';
      field.isLongText = true;
    } else if (node.type.name === 'Decimal') {
      field.type = 'Float';
      field.isDecimal = true;
    } else if (node.type.name === 'Date') {
      field.isDateOnly = true;
    }
    
    // Process field attributes
    for (const attr of node.attributes) {
      switch (attr.name) {
        case 'primaryKey':
          field.primaryKey = true;
          break;
        case 'unique':
          field.unique = true;
          break;
        case 'optional':
          field.optional = true;
          break;
        case 'readonly':
          field.readonly = true;
          break;
        case 'default':
          if (attr.arguments && attr.arguments.length > 0) {
            const arg = attr.arguments[0];
            if (arg.kind === 'StringLiteral') {
              field.default = arg.value;
            } else if (arg.kind === 'NumberLiteral') {
              field.default = arg.value;
            } else if (arg.kind === 'BooleanLiteral') {
              field.default = arg.value;
            } else if (arg.kind === 'Identifier') {
              field.default = arg.name;
              // No direct mapping for enum defaults in IR
            }
          }
          break;
        case 'validate':
          if (attr.arguments && attr.arguments.length > 0) {
            const arg = attr.arguments[0];
            if (arg.kind === 'StringLiteral') {
              field.validate = arg.value;
            } else if (arg.kind === 'ObjectLiteral') {
              // Convert object to string format as expected by the test
              const props = Object.entries(arg.properties);
              if (props.length > 0) {
                const [key, value] = props[0];
                let valueStr = '';
                
                if (value.kind === 'NumberLiteral') {
                  valueStr = value.value.toString();
                } else if (value.kind === 'StringLiteral') {
                  valueStr = value.value;
                } else if (value.kind === 'BooleanLiteral') {
                  valueStr = value.value.toString();
                }
                
                field.validate = `${key}: ${valueStr}`;
              }
            }
          }
          break;
        case 'virtual':
          field.isVirtual = true;
          // Extract virtual source from arguments
          if (attr.arguments && attr.arguments.length > 0) {
            const arg = attr.arguments[0];
            if (arg.kind === 'StringLiteral') {
              field.virtualFrom = arg.value;
            }
          }
          break;
      }
    }

    return field;
  }

  buildView(node: AST.ViewDeclarationNode): IRView {
    const view: IRView = {
      name: node.name.name,
      from: node.fromEntity.name,
      fields: []
    };

    for (const fieldNode of node.fields) {
      view.fields.push({
        name: fieldNode.name.name,
        type: fieldNode.type || 'String', // Default to String if type is not specified
        expression: fieldNode.expression,
      });
    }

    return view;
  }

  buildPage(node: AST.PageDeclarationNode): IRPage {
    const page: IRPage = {
      name: node.name.name,
      entity: node.entity.name,
      type: 'table', // Default
      route: '',
    };

    // Process properties
    for (const property of node.properties) {
      if (property.name === 'entity' && property.value.kind === 'Identifier') {
        page.entity = property.value.name;
      } else if (property.name === 'type' && property.value.kind === 'StringLiteral') {
        if (property.value.value === 'table' || 
            property.value.value === 'form' || 
            property.value.value === 'details' || 
            property.value.value === 'dashboard' || 
            property.value.value === 'custom') {
          page.type = property.value.value;
        }
      } else if (property.name === 'route' && property.value.kind === 'StringLiteral') {
        page.route = property.value.value;
      } else if (property.name === 'permissions' && property.value.kind === 'ArrayLiteral') {
        const permissions: string[] = [];
        const permElements = property.value.elements;
        
        for (const perm of permElements) {
          if (perm.kind === 'Identifier') {
            permissions.push(perm.name);
          } else if (perm.kind === 'StringLiteral') {
            permissions.push(perm.value);
          }
        }
        
        if (permissions.length > 0) {
          page.permissions = permissions;
        }
      } else if (property.name === 'title' && property.value.kind === 'StringLiteral') {
        page.title = property.value.value;
      } else if (property.name === 'props' && property.value.kind === 'ObjectLiteral') {
        // Convert AST object to plain JS object
        page.props = this.convertObjectLiteralToPlainObject(property.value);
      } else if (property.name === 'columns' && property.value.kind === 'ArrayLiteral') {
        page.columns = this.convertArrayLiteralToPlainArray(property.value);
      }
    }

    return page;
  }

  // Process config declaration
  private processConfig(node: AST.ConfigDeclarationNode): void {
    if (!this.app.config) this.app.config = {};

    if (node.name.name === 'auth') {
      this.app.config.auth = this.convertObjectLiteralToPlainObject(node.properties[0].value as AST.ObjectLiteralNode) as IRConfig['auth'];
    } else if (node.name.name === 'integrations') {
      this.app.config.integrations = this.convertObjectLiteralToPlainObject(node.properties[0].value as AST.ObjectLiteralNode) as IRConfig['integrations'];
    } else {
      for (const property of node.properties) {
        if (property.value.kind === 'StringLiteral') {
          this.app.config[property.name] = property.value.value;
        } else if (property.value.kind === 'ObjectLiteral') {
          this.app.config[property.name] = this.convertObjectLiteralToPlainObject(property.value);
        }
      }
    }
  }

  // Helper method to convert AST ObjectLiteral to plain JavaScript object
  private convertObjectLiteralToPlainObject(objLiteral: AST.ObjectLiteralNode): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(objLiteral.properties)) {
      if (value.kind === 'StringLiteral') {
        result[key] = value.value;
      } else if (value.kind === 'NumberLiteral') {
        result[key] = value.value;
      } else if (value.kind === 'BooleanLiteral') {
        result[key] = value.value;
      } else if (value.kind === 'Identifier') {
        result[key] = value.name;
      } else if (value.kind === 'ArrayLiteral') {
        result[key] = this.convertArrayLiteralToPlainArray(value);
      } else if (value.kind === 'ObjectLiteral') {
        result[key] = this.convertObjectLiteralToPlainObject(value);
      } else if (value.kind === 'FunctionCall') {
        // Handle function calls like env(VAR_NAME)
        if (value.name === 'env' && value.arguments.length > 0) {
          const arg = value.arguments[0];
          let varName = '';
          
          if (arg.kind === 'StringLiteral') {
            varName = arg.value;
          } else if (arg.kind === 'Identifier') {
            varName = arg.name;
          }
          
          result[key] = `env(${varName})`;
        }
      }
    }
    
    return result;
  }
  
  // Helper method to convert AST ArrayLiteral to plain JavaScript array
  private convertArrayLiteralToPlainArray(arrLiteral: AST.ArrayLiteralNode): any[] {
    const result: any[] = [];
    
    for (const element of arrLiteral.elements) {
      if (element.kind === 'StringLiteral') {
        result.push(element.value);
      } else if (element.kind === 'NumberLiteral') {
        result.push(element.value);
      } else if (element.kind === 'BooleanLiteral') {
        result.push(element.value);
      } else if (element.kind === 'Identifier') {
        result.push(element.name);
      } else if (element.kind === 'ArrayLiteral') {
        result.push(this.convertArrayLiteralToPlainArray(element));
      } else if (element.kind === 'ObjectLiteral') {
        result.push(this.convertObjectLiteralToPlainObject(element));
      } else if (element.kind === 'FunctionCall') {
        // Handle function calls like env(VAR_NAME)
        if (element.name === 'env' && element.arguments.length > 0) {
          const arg = element.arguments[0];
          let varName = '';
          
          if (arg.kind === 'StringLiteral') {
            varName = arg.value;
          } else if (arg.kind === 'Identifier') {
            varName = arg.name;
          }
          
          result.push(`env(${varName})`);
        }
      }
    }
    
    return result;
  }
}

