import * as fs from 'fs';
import * as path from 'path';

export function generateUiComponents(outDir: string) {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const uiTemplatesDir = path.join(templatesDir, 'components/ui');
  const libTemplatesDir = path.join(templatesDir, 'lib');

  const uiOutDir = path.join(outDir, 'src/components/ui');
  const libOutDir = path.join(outDir, 'src/lib');

  fs.mkdirSync(uiOutDir, { recursive: true });
  fs.mkdirSync(libOutDir, { recursive: true });

  // Generate UI components
  const uiComponentTemplates = fs.readdirSync(uiTemplatesDir);
  for (const template of uiComponentTemplates) {
    const templatePath = path.join(uiTemplatesDir, template);
    const content = fs.readFileSync(templatePath, 'utf-8');
    const outPath = path.join(uiOutDir, template.replace('.ejs', ''));
    fs.writeFileSync(outPath, content);
  }

  // Generate lib files
  const libTemplates = fs.readdirSync(libTemplatesDir);
  for (const template of libTemplates) {
    const templatePath = path.join(libTemplatesDir, template);
    const content = fs.readFileSync(templatePath, 'utf-8');
    const outPath = path.join(libOutDir, template.replace('.ejs', ''));
    fs.writeFileSync(outPath, content);
  }
}
