import { DSLParsingError } from './errors';
import { IApp, IREntity, IRField, IRPage, IRConfig, IRWorkflow, IRView } from './ir';

function cleanLine(line: string): string {
  if (!line) return '';
  return line.split('//')[0].trim();
}

function getIndent(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function throwParsingError(
  message: string,
  filePath: string | undefined,
  lines: string[],
  lineIndex: number,
  charIndex = 0
) {
  const context = lines[lineIndex];
  throw new DSLParsingError(message, filePath, lineIndex + 1, charIndex + 1, context);
}

type ParsedValue = string | number | boolean | ParsedValue[] | { [key: string]: ParsedValue };

function parseValue(value: string): ParsedValue {
  value = value.trim();
  if (value.endsWith(',')) {
    value = value.slice(0, -1);
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && !isNaN(Number(value))) {
    return Number(value);
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      // Attempt to parse as JSON, with relaxed syntax for keys and single quotes
      return JSON.parse(value.replace(/([{,][\s]*)(\w+)[\s]*:/g, '$1"$2":').replace(/'/g, '"'));
    } catch {
      // Fallback for simple arrays of strings
      return value.slice(1, -1).split(',').map(s => parseValue(s.trim()));
    }
  }
  return value;
}

function parseBlock(lines: string[], startIndex: number, filePath?: string): [Record<string, unknown>, number] {
  const block: Record<string, unknown> = {};
  let i = startIndex;
  const baseIndent = getIndent(lines[i - 1]);

  if (cleanLine(lines[i-1]).endsWith('{}')) {
    return [block, i - 1];
  }

  while (i < lines.length) {
    const line = lines[i];
    const indent = getIndent(line);

    if (indent <= baseIndent) {
      if (cleanLine(line) === '}') {
        return [block, i];
      }
      return [block, i - 1];
    }

    const cleaned = cleanLine(line);
    if (!cleaned) {
      i++;
      continue;
    }

    const parts = cleaned.split(':');
    const key = parts[0].trim();
    const value = parts.slice(1).join(':').trim();

    if (value.endsWith('{')) {
      const [nestedBlock, endIndex] = parseBlock(lines, i + 1, filePath);
      block[key] = nestedBlock;
      i = endIndex;
    } else if (value.startsWith('[')) {
        let fullArray = value;
        let j = i;
        // Handle multi-line arrays
        while(!fullArray.trim().endsWith(']') && j < lines.length - 1) {
            j++;
            fullArray += ' ' + lines[j].trim();
        }
        i = j;
        
        if (fullArray.includes('{')) {
          // It's an array of objects, requires special parsing
          const arrayContent = fullArray.slice(fullArray.indexOf('[') + 1, fullArray.lastIndexOf(']')).trim();
          const objects = [];
          const objectRegex = /{\s*([^}]+)\s*}/g;
          let match;
          while ((match = objectRegex.exec(arrayContent)) !== null) {
            const objectContent = match[1];
            const obj: Record<string, unknown> = {};
            const pairRegex = /(\w+)\s*:\s*([^,]+)/g;
            let pairMatch;
            while ((pairMatch = pairRegex.exec(objectContent)) !== null) {
              const k = pairMatch[1].trim();
              const v = pairMatch[2].trim();
              obj[k] = parseValue(v);
            }
            objects.push(obj);
          }
          block[key] = objects;
        } else {
          // It's a simple array
          block[key] = parseValue(fullArray);
        }
    } else {
      block[key] = parseValue(value);
    }
    i++;
  }
  return [block, i];
}

function validateFieldName(name: string, entityName: string, lines: string[], lineIndex: number, filePath?: string) {
  if (!name || name.trim() === '') {
    throwParsingError('Field name cannot be empty', filePath, lines, lineIndex);
  }
  if (!name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
    throwParsingError(`Invalid field name: "${name}". Field names must start with a letter or underscore and contain only letters, numbers, and underscores.`, filePath, lines, lineIndex);
  }
}

function validateFieldType(type: string, entityName: string, lines: string[], lineIndex: number, filePath?: string) {
  const validTypes = [
    'String', 'Text', 'Int', 'Float', 'Decimal', 'Boolean', 
    'DateTime', 'Date', 'UUID', 'JSON', 'Password'
  ];
  const baseType = type.replace('[]', ''); // Remove array notation
  
  if (!validTypes.includes(baseType) && !baseType.match(/^[A-Z][a-zA-Z0-9]*$/)) {
    throwParsingError(`Invalid field type: '${type}'. Must be one of: ${validTypes.join(', ')} or a valid entity reference.`, filePath, lines, lineIndex);
  }
}

function parseEntity(lines: string[], startIndex: number, name: string, filePath?: string): [IREntity, number] {
  const entity: IREntity = { name, fields: [], relations: [] };
  let i = startIndex;
  const baseIndent = getIndent(lines[i - 1]);

  if (cleanLine(lines[i-1]).endsWith('{}')) {
    entity.fields.unshift({ name: 'id', type: 'UUID', primaryKey: true });
    return [entity, i - 1];
  }

  while (i < lines.length) {
    const line = lines[i];
    const indent = getIndent(line);

    if (indent <= baseIndent) {
      if (cleanLine(line) === '}') {
        i++;
      }
      break;
    }

    const cleaned = cleanLine(line);
    if (!cleaned) {
      i++;
      continue;
    }

    const parts = cleaned.split(/\s+/);
    const fieldName = parts[0].replace(':', '');
    
    validateFieldName(fieldName, name, lines, i, filePath);
    
    if (entity.fields.find(f => f.name === fieldName)) {
      throwParsingError(`Duplicate field name '${fieldName}' in entity '${name}'`, filePath, lines, i);
    }
    
    if (!parts[1]) {
      throwParsingError(`Field type is required for field '${fieldName}' in entity '${name}'`, filePath, lines, i);
    }
    
    const fieldType = parts[1];
    
    if (!cleaned.includes('@relation')) {
        validateFieldType(fieldType, name, lines, i, filePath);
    }

    if (cleaned.includes('@relation')) {
      // Parse relation directive
      const relationMatch = cleaned.match(/@relation\(name:\s*"([^"]+)"\)/);
      let relationName: string | undefined;
      
      if (relationMatch) {
        relationName = relationMatch[1];
      }

      // Add the relation to the entity
      entity.relations?.push({
        field: fieldName,
        type: fieldType.endsWith('[]') ? 'one-to-many' : 'many-to-one',
        target: fieldType.replace('[]', ''),
        relationName
      });
    } else {
      // Regular field
      const field: IRField = { name: fieldName, type: fieldType };
      
      // Parse attributes
      if (parts.includes('primaryKey')) field.primaryKey = true;
      if (parts.includes('unique')) field.unique = true;
      if (parts.includes('optional')) field.optional = true;
      if (parts.includes('readonly')) field.readonly = true;
      
      // Handle special field types
      if (fieldType === 'Password') {
        field.isPassword = true;
        field.type = 'String'; // Internally represented as String
      } else if (fieldType === 'Text') {
        field.type = 'String';
        field.isLongText = true;
      } else if (fieldType === 'Decimal') {
        field.type = 'Decimal';
        field.isDecimal = true;
      } else if (fieldType === 'JSON') {
        field.type = 'Json';
      } else if (fieldType === 'Date') {
        field.type = 'DateTime';
        field.isDateOnly = true;
      }
      
      const defaultMatch = cleaned.match(/default\((.*?)\)/);
      if (defaultMatch) {
        try {
          const parsedValue = parseValue(defaultMatch[1]);
          if (typeof parsedValue === 'string' || typeof parsedValue === 'number' || typeof parsedValue === 'boolean') {
            field.default = parsedValue;
          } else {
            throwParsingError(`Default value for field '${fieldName}' must be a string, number, or boolean`, filePath, lines, i);
          }
        } catch {
          throwParsingError(`Invalid default value for field '${fieldName}' in entity '${name}'`, filePath, lines, i);
        }
      }
      const validateMatch = cleaned.match(/validate\((.*?)\)/);
      if (validateMatch) {
        field.validate = validateMatch[1];
        
        // Parse common validations
        const minMatch = field.validate.match(/min:\s*(\d+)/);
        const maxMatch = field.validate.match(/max:\s*(\d+)/);
        const patternMatch = field.validate.match(/pattern:\s*"([^"]*)"/);
        
        if (minMatch) field.min = parseInt(minMatch[1], 10);
        if (maxMatch) field.max = parseInt(maxMatch[1], 10);
        if (patternMatch) field.pattern = patternMatch[1];
      }

      const virtualMatch = cleaned.match(/@virtual\(from:\s*"([^"]+)"\)/);
      if (virtualMatch) {
        field.isVirtual = true;
        field.virtualFrom = virtualMatch[1];
      }

      entity.fields.push(field);
    }
    i++;
  }
  
  // Validate entity has primary key
  const hasPrimaryKey = entity.fields.some(field => field.primaryKey);
  if (!hasPrimaryKey) {
    // Add default UUID primary key if none specified
    entity.fields.unshift({
      name: 'id',
      type: 'UUID',
      primaryKey: true
    });
  }
  
  return [entity, i - 1];
}

function parseView(lines: string[], startIndex: number, name: string, filePath?: string): [IRView, number] {
    const [block, endIndex] = parseBlock(lines, startIndex, filePath);

    if (!block.from) {
        throwParsingError(`View '${name}' must have a 'from' property.`, filePath, lines, startIndex - 1);
    }

    if (!block.fields || !Array.isArray(block.fields)) {
        throwParsingError(`View '${name}' must have a 'fields' property that is an array.`, filePath, lines, startIndex - 1);
    }

    const view: IRView = {
        name,
        from: block.from as string,
        fields: (block.fields as any[]).map(f => ({
            name: f.name,
            type: f.type,
            expression: f.expression,
        })),
    };

    return [view, endIndex];
}

export function parseDSL(dsl: string, filePath?: string): IApp {
  const lines = dsl.split('\n');
  if (!dsl.trim() || lines.every(line => !line.trim() || line.trim().startsWith('//'))) {
    throw new DSLParsingError('DSL file is empty or contains only comments. At least one entity block is required.', filePath);
  }
  
  const app: IApp = { name: 'App', entities: [], pages: [], views: [], workflows: [], config: { enums: {} } };
  let i = 0;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);
    if (!line) {
      i++;
      continue;
    }

    const match = line.match(/^(entity|page|workflow|config|enum|view)\s+(\w+)\s*\{/);
    if (match) {
      const [, type, name] = match;
      let block, endIndex = i;

      if (type === 'entity') {
        [block, endIndex] = parseEntity(lines, i + 1, name, filePath);
        app.entities.push(block as IREntity);
      } else if (type === 'view') {
        [block, endIndex] = parseView(lines, i + 1, name, filePath);
        if (!app.views) {
          app.views = [];
        }
        app.views.push(block as IRView);
      } else {
        [block, endIndex] = parseBlock(lines, i + 1, filePath);
        switch (type) {
          case 'page': {
            const pageName = name;
            
            const page: IRPage = {
              name: pageName,
              type: 'table',
              entity: '',
              route: `/${pageName.toLowerCase()}`,
            };

            for (const [key, value] of Object.entries(block)) {
                switch(key) {
                    case 'type':
                        page.type = value as IRPage['type'];
                        break;
                    case 'entity':
                        page.entity = value as string;
                        break;
                    case 'route':
                        page.route = value as string;
                        break;
                    case 'permissions':
                        if (typeof value === 'string') {
                            page.permissions = value.split(',').map(p => p.trim());
                        } else {
                            page.permissions = value as string[];
                        }
                        break;
                    case 'title':
                        page.title = value as string;
                        break;
                    case 'columns':
                        if (typeof value === 'string') {
                            page.columns = value.split(',').map(c => {
                                const [field, label] = c.trim().split(':');
                                return { field, label: label.trim() };
                            });
                        } else {
                            page.columns = value as Array<{ field: string; label: string }>;
                        }
                        break;
                    case 'props':
                        page.props = value as IRPage['props'];
                        break;
                }
            }

            if (!page.entity && page.type !== 'custom') {
                throwParsingError(`Page '${pageName}' of type '${page.type}' must have an 'entity' property.`, filePath, lines, i);
            }
            
            app.pages.push(page);
            break;
          }
          case 'workflow':
            app.workflows?.push({ name, ...block } as IRWorkflow);
            break;
          case 'config':
            if (app.config) {
                if (name === 'auth') {
                    app.config.auth = block as IRConfig['auth'];
                } else if (name === 'integrations') {
                    app.config.integrations = block as IRConfig['integrations'];
                }
            }
            break;
          case 'enum':
            if (app.config?.enums) {
              app.config.enums[name] = Object.keys(block);
            }
            break;
        }
      }
      i = endIndex + 1;
    } else {
        if (i < lines.length -1) {
            i++;
        } else {
            throwParsingError('Invalid syntax', filePath, lines, i);
        }
    }
  }

  validateIR(app, filePath, lines);
  return app;
}

// Main validation function
export function validateIR(app: IApp, filePath?: string, lines: string[] = []) {
  const entityNames = new Set(app.entities.map(e => e.name));
  const enumNames = new Set(Object.keys(app.config?.enums || {}));

  // Validate Relationships
  for (const entity of app.entities) {
    if (entity.relations) {
      for (const relation of entity.relations) {
        if (!entityNames.has(relation.target)) {
          // Find line number for this error
          const lineIndex = lines.findIndex(l => l.includes(`entity ${entity.name}`) && l.includes(relation.field));
          throwParsingError(`Entity '${relation.target}' not found for relation '${relation.field}' in entity '${entity.name}'`, filePath, lines, lineIndex > -1 ? lineIndex : 0);
        }
      }
    }
    // Validate field types that are enums
    for (const field of entity.fields) {
        if (field.type.match(/^[A-Z][a-zA-Z0-9]*$/) && !entityNames.has(field.type) && !enumNames.has(field.type)) {
            const validTypes = ['String', 'Text', 'Int', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Date', 'UUID', 'JSON', 'Password'];
            if (!validTypes.includes(field.type) && field.type !== 'Json') {
                const lineIndex = lines.findIndex(l => l.includes(`entity ${entity.name}`) && l.includes(field.name));
                throwParsingError(`Type '${field.type}' for field '${field.name}' is not a defined entity or enum.`, filePath, lines, lineIndex > -1 ? lineIndex : 0);
            }
        }
    }
  }

  // Validate Page Entities
  const viewNames = new Set(app.views?.map(v => v.name) || []);
  for (const page of app.pages) {
    if (page.entity && !entityNames.has(page.entity) && !viewNames.has(page.entity)) {
      const lineIndex = lines.findIndex(l => l.includes(`page ${page.name}`));
      throwParsingError(`Entity or View '${page.entity}' not found for page '${page.name}'`, filePath, lines, lineIndex > -1 ? lineIndex : 0);
    }
  }

  // Validate View Entities
  if (app.views) {
    for (const view of app.views) {
      if (!entityNames.has(view.from)) {
        const lineIndex = lines.findIndex(l => l.includes(`view ${view.name}`));
        throwParsingError(`Entity '${view.from}' not found for view '${view.name}'`, filePath, lines, lineIndex > -1 ? lineIndex : 0);
      }
    }
  }

  // Validate Auth Config
  if (app.config?.auth?.userEntity && !entityNames.has(app.config.auth.userEntity)) {
    const lineIndex = lines.findIndex(l => l.includes('config auth'));
    throwParsingError(`User entity '${app.config.auth.userEntity}' not found in auth config`, filePath, lines, lineIndex > -1 ? lineIndex : 0);
  }
}