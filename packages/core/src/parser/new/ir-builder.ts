/**
 * IR Builder for the DSL
 * 
 * The IR Builder converts the validated AST into an IR (Intermediate Representation)
 * that is used for code generation.
 */
import { IApp, IREntity, IRField, IRPage, IRRelation, IRView, IRWorkflow, IRWorkflowStep } from '../../ir';
import * as AST from './ast';

/**
 * Build an IR from an AST
 */
export function buildIR(ast: AST.Program): IApp {
  const builder = new IRBuilder();
  return builder.build(ast);
}

class IRBuilder {
  private app: IApp = {
    name: 'DefaultApp',
    entities: [],
    pages: [],
    config: {}
  };
  
  private enumDefinitions: Record<string, string[]> = {};
  
  /**
   * Build an IR from an AST
   */
  build(ast: AST.Program): IApp {
    // Initialize the IR
    this.app = {
      name: 'DefaultApp',
      entities: [],
      views: [],
      pages: [],
      workflows: [],
      config: {
        enums: {}
      }
    };
    
    // First pass: collect enums
    for (const decl of ast.declarations) {
      if (decl.type === 'EnumDeclaration') {
        this.processEnum(decl);
      }
    }
    
    // Store the enum definitions in the IR
    if (Object.keys(this.enumDefinitions).length > 0) {
      if (!this.app.config) this.app.config = {};
      this.app.config.enums = this.enumDefinitions;
    }
    
    // Second pass: process all other declarations
    for (const decl of ast.declarations) {
      switch (decl.type) {
        case 'EntityDeclaration':
          this.app.entities.push(this.processEntity(decl));
          break;
          
        case 'ViewDeclaration':
          if (!this.app.views) this.app.views = [];
          this.app.views.push(this.processView(decl));
          break;
          
        case 'PageDeclaration':
          this.app.pages.push(this.processPage(decl));
          break;
          
        case 'WorkflowDeclaration':
          if (!this.app.workflows) this.app.workflows = [];
          this.app.workflows.push(this.processWorkflow(decl));
          break;
          
        case 'ConfigDeclaration':
          this.processConfig(decl);
          break;
      }
    }
    
    // Apply any necessary post-processing
    this.postProcess();
    
    return this.app;
  }
  
  /**
   * Process an enum declaration
   */
  private processEnum(enumDecl: AST.EnumDeclaration): void {
    const enumName = enumDecl.name.name;
    const values = enumDecl.values.map(v => v.name.name);
    
    // Store the enum definition
    this.enumDefinitions[enumName] = values;
  }
  
  /**
   * Process an entity declaration
   */
  private processEntity(entity: AST.EntityDeclaration): IREntity {
    const irEntity: IREntity = {
      name: entity.name.name,
      fields: [],
      relations: []
    };
    
    // Process each field
    for (const member of entity.members) {
      if (member.type === 'FieldDeclaration') {
        const field = this.processField(member);
        
        // Check if this is a relation field
        const relationAttr = member.attributes.find(attr => attr.name === 'relation');
        
        if (relationAttr && relationAttr.arguments && relationAttr.arguments.length > 0) {
          // Get the relation name
          const relationNameArg = relationAttr.arguments[0];
          let relationName = '';
          
          if (relationNameArg.type === 'StringLiteral') {
            relationName = relationNameArg.value;
          }
          
          // Determine relation type
          const isArray = member.fieldType.isArray;
          const relationType = isArray ? 'one-to-many' : 'many-to-one';
          
          // Add the relation
          if (!irEntity.relations) irEntity.relations = [];
          
          irEntity.relations.push({
            type: relationType,
            target: member.fieldType.typeName.name,
            field: member.name.name,
            relationName
          });
          
          // Mark the field as a relation
          field.relation = member.fieldType.typeName.name;
        }
        
        irEntity.fields.push(field);
      }
    }
    
    // Check if the entity has a primary key
    const hasPrimaryKey = irEntity.fields.some(f => f.primaryKey);
    
    // If no primary key, add an 'id' field
    if (!hasPrimaryKey && !irEntity.fields.some(f => f.name === 'id')) {
      irEntity.fields.unshift({
        name: 'id',
        type: 'UUID',
        primaryKey: true
      });
    }
    
    return irEntity;
  }
  
  /**
   * Process a field declaration
   */
  private processField(field: AST.FieldDeclaration): IRField {
    const irField: IRField = {
      name: field.name.name,
      type: field.fieldType.typeName.name
    };
    
    // Handle array types
    if (field.fieldType.isArray) {
      irField.type += '[]';
    }
    
    // Process field attributes
    for (const attr of field.attributes) {
      switch (attr.name) {
        case 'primaryKey':
          irField.primaryKey = true;
          break;
          
        case 'unique':
          irField.unique = true;
          break;
          
        case 'optional':
          irField.optional = true;
          break;
          
        case 'readonly':
          irField.readonly = true;
          break;
          
        case 'default':
          if (attr.arguments && attr.arguments.length > 0) {
            const defaultValue = this.evaluateExpression(attr.arguments[0]);
            irField.default = defaultValue;
          }
          break;
      }
    }
    
    // Handle special field types
    if (irField.type === 'Password') {
      irField.isPassword = true;
      irField.type = 'String';
    } else if (irField.type === 'Text') {
      irField.isLongText = true;
      irField.type = 'String';
    } else if (irField.type === 'Decimal') {
      irField.isDecimal = true;
      irField.type = 'Decimal';
    } else if (irField.type === 'Date') {
      irField.isDateOnly = true;
      irField.type = 'DateTime';
    }
    
    return irField;
  }
  
  /**
   * Process a view declaration
   */
  private processView(view: AST.ViewDeclaration): IRView {
    const irView: IRView = {
      name: view.name.name,
      from: view.from.name,
      fields: []
    };
    
    // Process each field
    for (const field of view.fields) {
      irView.fields.push({
        name: field.name.name,
        type: field.fieldType ? field.fieldType.name : 'String',
        expression: field.expression
      });
    }
    
    return irView;
  }
  
  /**
   * Process a page declaration
   */
  private processPage(page: AST.PageDeclaration): IRPage {
    const irPage: IRPage = {
      name: page.name.name,
      type: 'custom',  // Default type
      entity: page.entity ? page.entity.name : '',
      route: '',       // Will be filled from properties
      permissions: []  // Will be filled from properties
    };
    
    // Process page properties
    for (const prop of page.properties) {
      const key = prop.key.name;
      const value = this.evaluateExpression(prop.value);
      
      switch (key) {
        case 'type':
          irPage.type = value as any;
          break;
          
        case 'route':
          irPage.route = value as string;
          break;
          
        case 'permissions':
          if (Array.isArray(value)) {
            irPage.permissions = value as string[];
          }
          break;
          
        case 'title':
          irPage.title = value as string;
          break;
          
        case 'columns':
          irPage.columns = value as any;
          break;
          
        default:
          // Store other properties in the props object
          if (!irPage.props) irPage.props = {};
          irPage.props[key] = value;
          break;
      }
    }
    
    return irPage;
  }
  
  /**
   * Process a workflow declaration
   */
  private processWorkflow(workflow: AST.WorkflowDeclaration): IRWorkflow {
    const irWorkflow: IRWorkflow = {
      name: workflow.name.name,
      trigger: {
        event: '',
        entity: ''
      },
      steps: []
    };
    
    // Process workflow properties
    for (const prop of workflow.properties) {
      if (prop.key.name === 'trigger') {
        const triggerObj = this.evaluateExpression(prop.value);
        
        if (typeof triggerObj === 'object' && triggerObj !== null) {
          if ('event' in triggerObj) {
            irWorkflow.trigger.event = String(triggerObj.event);
          }
          
          if ('entity' in triggerObj) {
            irWorkflow.trigger.entity = String(triggerObj.entity);
          }
        }
      } else if (prop.key.name === 'steps') {
        const steps = this.evaluateExpression(prop.value);
        
        if (Array.isArray(steps)) {
          irWorkflow.steps = steps.map(step => {
            const irStep: IRWorkflowStep = {
              action: '',
              inputs: {}
            };
            
            if (typeof step === 'object' && step !== null) {
              if ('action' in step) {
                irStep.action = String(step.action);
              }
              
              if ('inputs' in step && typeof step.inputs === 'object' && step.inputs !== null) {
                irStep.inputs = step.inputs;
              }
            }
            
            return irStep;
          });
        }
      }
    }
    
    return irWorkflow;
  }
  
  /**
   * Process a config declaration
   */
  private processConfig(config: AST.ConfigDeclaration): void {
    const configName = config.name.name;
    
    // Convert properties to an object
    const configObj: Record<string, any> = {};
    
    for (const prop of config.properties) {
      configObj[prop.key.name] = this.evaluateExpression(prop.value);
    }
    
    // Store in the appropriate config section
    if (!this.app.config) this.app.config = {};
    this.app.config[configName] = configObj;
  }
  
  /**
   * Evaluate an AST expression to a JavaScript value
   */
  private evaluateExpression(expr: AST.Expression): any {
    switch (expr.type) {
      case 'StringLiteral':
        return expr.value;
        
      case 'NumberLiteral':
        return expr.value;
        
      case 'BooleanLiteral':
        return expr.value;
        
      case 'Identifier':
        // For identifiers, we can't resolve values at this stage,
        // so we just return the name as a string
        return expr.name;
        
      case 'ArrayLiteral':
        return expr.elements.map(elem => this.evaluateExpression(elem));
        
      case 'ObjectLiteral':
        const obj: Record<string, any> = {};
        for (const prop of expr.properties) {
          obj[prop.key.name] = this.evaluateExpression(prop.value);
        }
        return obj;
        
      case 'QualifiedIdentifier':
        // For qualified identifiers, we return the full path as a string
        return expr.parts.join('.');
        
      case 'FunctionCall':
        // For function calls, we can't evaluate them here,
        // so we return an object representation
        return {
          function: expr.callee.name,
          args: expr.arguments.map(arg => this.evaluateExpression(arg))
        };
        
      default:
        return null;
    }
  }
  
  /**
   * Apply any necessary post-processing to the IR
   */
  private postProcess(): void {
    // Process relationships to ensure both sides are defined
    this.processRelationships();
  }
  
  /**
   * Process relationships to ensure both sides are defined
   */
  private processRelationships(): void {
    // Collect all relations
    const relations: Array<{ entity: string; relation: IRRelation }> = [];
    
    for (const entity of this.app.entities) {
      if (entity.relations) {
        for (const relation of entity.relations) {
          relations.push({
            entity: entity.name,
            relation
          });
        }
      }
    }
    
    // Ensure both sides of each relation are defined
    for (const { entity: sourceEntity, relation } of relations) {
      const targetEntity = this.app.entities.find(e => e.name === relation.target);
      
      if (targetEntity) {
        // Check if the target entity has the inverse relation
        const hasInverse = targetEntity.relations?.some(r => 
          r.target === sourceEntity && r.relationName === relation.relationName
        );
        
        if (!hasInverse) {
          // Add the inverse relation
          if (!targetEntity.relations) {
            targetEntity.relations = [];
          }
          
          // Determine the inverse relation type
          let inverseType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
          
          switch (relation.type) {
            case 'one-to-one':
              inverseType = 'one-to-one';
              break;
            case 'one-to-many':
              inverseType = 'many-to-one';
              break;
            case 'many-to-one':
              inverseType = 'one-to-many';
              break;
            case 'many-to-many':
              inverseType = 'many-to-many';
              break;
          }
          
          // Add a virtual field for the inverse relation
          targetEntity.fields.push({
            name: sourceEntity.toLowerCase() + 's',
            type: sourceEntity + '[]',
            isVirtual: true,
            virtualFrom: relation.relationName || `${sourceEntity}To${targetEntity.name}`
          });
          
          targetEntity.relations.push({
            type: inverseType,
            target: sourceEntity,
            field: sourceEntity.toLowerCase() + 's',
            relationName: relation.relationName
          });
        }
      }
    }
  }
}
