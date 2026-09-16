import {readFile,writeFile} from 'node:fs/promises';
import {wireAtomicForm} from './application-business-v2/atomic-forms.mjs';
const helper=await readFile('assets/portal-runtime/client-application-intent-v2.js','utf8');
for(const version of ['v3','v2']){
 const path=`assets/portal-runtime/client-application-form-${version}.js`;
 await writeFile(path,wireAtomicForm(await readFile(path,'utf8'),version,helper),'utf8');
 console.log(`ATOMIC_APPLICATION_FORM_${version.toUpperCase()}=WIRED`);
}
