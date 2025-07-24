import { generatePrismaSchema } from '../prisma';
import { IApp } from '@stalmer1/core';

describe('Prisma Schema Generator', () => {
  it('should generate a prisma schema with a view', () => {
    const app: IApp = {
      name: 'TestApp',
      entities: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', primaryKey: true },
            { name: 'firstName', type: 'String' },
            { name: 'lastName', type: 'String' },
          ],
        },
      ],
      views: [
        {
          name: 'UserView',
          from: 'User',
          fields: [
            { name: 'fullName', type: 'String', expression: "firstName || ' ' || lastName" },
          ],
        },
      ],
      pages: [],
    };

    const schema = generatePrismaSchema(app);

    expect(schema).toContain('model User');
    expect(schema).toContain('model UserView');
    expect(schema).toContain('/// @readonly');
    expect(schema).toContain('@@map(name: null) /// @db.view');
  });
});
