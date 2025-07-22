import { DSLParsingError } from './errors';
import { IApp, IREntity, IRField, IRPage, IRConfig, IRWorkflow } from './ir';

function cleanLine(line: string): string {
  if (!line) return '';
  return line.split('//')[0].trim();
}

function getIndent(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
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
      return JSON.parse(value.replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":').replace(/'/g, '"'));
    } catch {
      // Fallback for simple arrays of strings
      return value.slice(1, -1).split(',').map(s => parseValue(s.trim()));
    }
  }
  return value;
}

function parseBlock(lines: string[], startIndex: number): [Record<string, unknown>, number] {
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
      const [nestedBlock, endIndex] = parseBlock(lines, i + 1);
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

function validateFieldName(name: string): string | null {
  if (!name || name.trim() === '') return 'Field name cannot be empty';
  if (!name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) return 'Field name must start with a letter or underscore and contain only letters, numbers, and underscores';
  return null;
}

function validateFieldType(type: string): string | null {
  const validTypes = [
    'String', 'Text', 'Int', 'Float', 'Decimal', 'Boolean', 
    'DateTime', 'Date', 'UUID', 'JSON', 'Password'
  ];
  const baseType = type.replace('[]', ''); // Remove array notation
  
  if (!validTypes.includes(baseType) && !baseType.match(/^[A-Z][a-zA-Z0-9]*$/)) {
    return `Invalid field type: '${type}'. Must be one of: ${validTypes.join(', ')} or an entity reference`;
  }
  return null;
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
    const lineNumber = i + 1;

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
    
    const fieldNameError = validateFieldName(fieldName);
    if (fieldNameError) {
      throw new DSLParsingError( `${fieldNameError} in entity '${name}'`, filePath, lineNumber);
    }
    
    if (entity.fields.find(f => f.name === fieldName)) {
      throw new DSLParsingError(`Duplicate field name '${fieldName}' in entity '${name}'`, filePath, lineNumber);
    }
    
    if (!parts[1]) {
      throw new DSLParsingError(`Field type is required for field '${fieldName}' in entity '${name}'`, filePath, lineNumber);
    }
    
    const fieldType = parts[1];
    
    const fieldTypeError = validateFieldType(fieldType);
    if (fieldTypeError && !cleaned.includes('@relation')) {
      throw new DSLParsingError(`${fieldTypeError} in entity '${name}'`, filePath, lineNumber);
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
            throw new DSLParsingError(`Default value for field '${fieldName}' must be a string, number, or boolean`, filePath, lineNumber);
          }
        } catch {
          throw new DSLParsingError(`Invalid default value for field '${fieldName}' in entity '${name}'`, filePath, lineNumber);
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

export function parseDSL(dsl: string, filePath?: string): IApp {
  if (!dsl.trim() || dsl.trim().split('\n').every(line => !line.trim() || line.trim().startsWith('//'))) {
    throw new DSLParsingError('At least one entity block is required.', filePath);
  }
  
  const app: IApp = { name: 'App', entities: [], pages: [], workflows: [], config: { enums: {} } };
  const lines = dsl.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = cleanLine(lines[i]);
    if (!line) {
      i++;
      continue;
    }

    const match = line.match(/^(entity|page|workflow|config|enum)\s+(\w+)\s*\{/);
    if (match) {
      const [, type, name] = match;
      let block, endIndex = i;

      if (type === 'entity') {
        [block, endIndex] = parseEntity(lines, i + 1, name, filePath);
        app.entities.push(block as IREntity);
      } else {
        [block, endIndex] = parseBlock(lines, i + 1);
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

            if (!page.entity) {
              if (page.type !== 'custom') {
                throw new DSLParsingError(`Page '${pageName}' of type '${page.type}' must have an 'entity' property.`, filePath, i + 1);
              }
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
      i++;
    }
  }

  return app;
}
