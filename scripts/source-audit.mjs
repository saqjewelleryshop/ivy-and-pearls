import fs from 'node:fs';import path from 'node:path';
const must=[
 ['size guide route','src/App.jsx','/size-guide/'],['care route','src/App.jsx','/jewellery-care/'],['materials route','src/App.jsx','/materials/'],
 ['private client route','src/App.jsx','/private-client/'],['security route','src/App.jsx','/security/'],['PDP size guide','src/pages/Product.jsx','View the size guide'],
 ['PDP swipe','src/pages/Product.jsx','onTouchStart'],['PDP lightbox','src/pages/Product.jsx','product-lightbox'],['upload signature','server/routes/api.js','isAllowedImage'],
 ['request ids','server/index.js','requestId'],['health endpoint','server/index.js',"'/healthz'"],['security.txt','server/index.js','security.txt'],
 ['CI quality gate','.github/workflows/quality.yml','npm run build'],['runbook','ENTERPRISE-RUNBOOK.md','Incident response']
];
let failed=0;for(const [name,file,needle] of must){const full=path.resolve(file);const ok=fs.existsSync(full)&&fs.readFileSync(full,'utf8').includes(needle);console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;}if(failed)process.exit(1);
