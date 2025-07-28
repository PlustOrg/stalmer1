/**
 * Tests for complex view and workflow declarations in the DSL.
 */

import { parseDSL } from '../src/parser/new-index';
import { DSLParsingError } from '../src/errors';

describe('New DSL Parser - Complex Views', () => {
  it('should parse views with joins and complex expressions', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        firstName: String
        lastName: String
      }
      
      entity Post {
        id: UUID primaryKey
        title: String
        content: Text
        author: User @relation(name: "UserPosts")
        createdAt: DateTime readonly
      }
      
      view UserPostStats {
        from: User
        fields: [
          { name: "userId", expression: "id" },
          { name: "userName", expression: "CONCAT(firstName, ' ', lastName)" },
          { name: "postCount", expression: "COUNT(posts.id)" },
          { name: "lastPostDate", expression: "MAX(posts.createdAt)" },
          { name: "hasPublished", expression: "CASE WHEN COUNT(posts.id) > 0 THEN true ELSE false END" }
        ]
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.views).toBeDefined();
    expect(ir.views?.length).toBe(1);
    
    const view = ir.views?.[0];
    expect(view?.name).toBe('UserPostStats');
    expect(view?.from).toBe('User');
    expect(view?.fields.length).toBe(5);
    
    expect(view?.fields[1]).toMatchObject({
      name: 'userName',
      type: 'String',
      expression: "CONCAT(firstName, ' ', lastName)"
    });
    
    expect(view?.fields[4]).toMatchObject({
      name: 'hasPublished',
      type: 'String',
      expression: "CASE WHEN COUNT(posts.id) > 0 THEN true ELSE false END"
    });
  });
  
  it('should parse views with multiple fields', () => {
    const dsl = `
      entity Product {
        id: UUID primaryKey
        name: String
        price: Decimal
        category: String
        inStock: Boolean default(true)
      }
      
      view ProductSummary {
        from: Product
        fields: [
          { name: "id", expression: "id" },
          { name: "name", expression: "name" },
          { name: "price", expression: "price" },
          { name: "category", expression: "category" },
          { name: "formattedPrice", expression: "CONCAT('$', CAST(price AS STRING))" },
          { name: "availability", expression: "CASE WHEN inStock THEN 'In Stock' ELSE 'Out of Stock' END" }
        ]
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.views?.length).toBe(1);
    
    const view = ir.views?.[0];
    expect(view?.name).toBe('ProductSummary');
    expect(view?.from).toBe('Product');
    expect(view?.fields.length).toBe(6);
    expect(view?.fields[4].name).toBe('formattedPrice');
    expect(view?.fields[5].name).toBe('availability');
    expect(view?.fields[5].expression).toBe("CASE WHEN inStock THEN 'In Stock' ELSE 'Out of Stock' END");
  });
});

describe('New DSL Parser - Complex Workflows', () => {
  it('should parse workflows with multiple steps and conditions', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        email: String
        verified: Boolean default(false)
      }
      
      entity VerificationToken {
        id: UUID primaryKey
        token: String
        user: User
        createdAt: DateTime readonly
        expiresAt: DateTime
      }
      
      workflow UserVerification {
        trigger: {
          event: "user.created"
          entity: User
        }
        steps: [
          {
            action: "createVerificationToken"
            inputs: {
              user: "trigger.user"
              expiry: "NOW() + INTERVAL 24 HOUR"
            }
          },
          {
            action: "sendEmail"
            inputs: {
              to: "trigger.user.email"
              subject: "Verify Your Account"
              template: "verification"
            }
          }
        ]
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.workflows).toBeDefined();
    expect(ir.workflows?.length).toBe(1);
    
    const workflow = ir.workflows?.[0];
    expect(workflow?.name).toBe('UserVerification');
    expect(workflow?.trigger.event).toBe('user.created');
    expect(workflow?.trigger.entity).toBe('User');
    expect(workflow?.steps.length).toBe(3);
    
    // Check workflow structure
    expect(workflow?.trigger.event).toBe('user.created');
    expect(workflow?.trigger.entity).toBe('User');
    expect(workflow?.steps).toHaveLength(2);
    
    // Check steps
    expect(workflow?.steps[0].action).toBe('createVerificationToken');
    expect(workflow?.steps[0].inputs.user).toBe('trigger.user');
    expect(workflow?.steps[0].inputs.expiry).toBe('NOW() + INTERVAL 24 HOUR');
    
    expect(workflow?.steps[1].action).toBe('sendEmail');
    expect(workflow?.steps[1].inputs.to).toBe('trigger.user.email');
    expect(workflow?.steps[1].inputs.template).toBe('verification');
  });
  
  it('should parse workflows with branching logic', () => {
    const dsl = `
      entity User {
        id: UUID primaryKey
        email: String
        isActive: Boolean default(true)
        lastLoginAt: DateTime optional
      }
      
      workflow UserInactivity {
        trigger: {
          event: "schedule.daily"
        }
        
        steps: [
          {
            action: "findUsers"
            inputs: {
              where: "isActive = true AND lastLoginAt < NOW() - INTERVAL 30 DAY"
            }
          },
          {
            action: "sendEmail"
            inputs: {
              to: "users.email"
              subject: "We miss you!"
              template: "comeback"
            }
          },
          {
            action: "updateUsers"
            inputs: {
              where: "lastLoginAt < NOW() - INTERVAL 90 DAY"
              data: {
                isActive: false
              }
            }
          }
        ]
      }
    `;
    
    const ir = parseDSL(dsl);
    expect(ir.workflows).toBeDefined();
    expect(ir.workflows?.length).toBe(1);
    
    const workflow = ir.workflows?.[0];
    expect(workflow?.name).toBe('UserInactivity');
    expect(workflow?.trigger.event).toBe('schedule.daily');
    expect(workflow?.steps.length).toBe(2);
    
    // Check forEach step
    expect(workflow?.steps[1].action).toBe('forEach');
    expect(workflow?.steps[1].inputs.var).toBe('user');
    expect((workflow?.steps[1].inputs.steps as any).length).toBe(2);
    
    // Check conditional step
    const conditionalStep = (workflow?.steps[1].inputs.steps as any)[1];
    expect(conditionalStep.action).toBe('conditional');
    expect(conditionalStep.inputs.condition).toBe('user.lastLoginAt < NOW() - INTERVAL 90 DAY');
    expect((conditionalStep.inputs.thenSteps as any).length).toBe(1);
    
    // Check update user step
    const updateStep = (conditionalStep.inputs.thenSteps as any)[0];
    expect(updateStep.action).toBe('updateUser');
    expect(updateStep.inputs.data.isActive).toBe(false);
  });
});
