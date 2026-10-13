/**
 * DISPOSABLE BUILD PREVIEW ONLY.
 * A Client-only workflow read failure is not the same as "no documents".
 * Never write the protected client-deal-documents-v5.js source.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const SOURCE='assets/portal-runtime/client-deal-documents-v5.js';
const EMITTED='dist/assets/portal-runtime/client-deal-documents-v5.js';
const EXPECTED_GIT_BLOB='a1b724867218de56a168372dd33fc8d16a4f6266';
const raw=await readFile(SOURCE);
const actual=createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');
assert.equal(actual,EXPECTED_GIT_BLOB,'PROTECTED_CLIENT_DOCUMENTS_SOURCE_DRIFT');
const before=await readFile(EMITTED,'utf8');
let modified=before;
const replacements=[
  [
    '.catch(()=>({deals:[]}))',
    '.catch(()=>({deals:[],workflow_unavailable:true}))'
  ],
  [
    'next.set(dealId,{dealId,clientId,contractId,deal:d,workflow:wfMap.get(dealId)||{},documents:dealDocs});',
    'next.set(dealId,{dealId,clientId,contractId,deal:d,workflow:wfMap.get(dealId)||{},workflowUnavailable:workflow?.workflow_unavailable===true,documents:dealDocs});'
  ],
  [
    'signed:text(info.workflow?.signed_addendum_document_id)})',
    'signed:text(info.workflow?.signed_addendum_document_id),workflowUnavailable:info.workflowUnavailable===true})'
  ],
  [
    'if(signed.length)p.append',
    "if(info.workflowUnavailable)p.append(el('div',PANEL+'__error','Статус документооборота временно недоступен. Загрузка подписанного файла недоступна.'));if(signed.length)p.append"
  ]
];
for(const [oldText,newText] of replacements){
 assert.equal(modified.split(oldText).length,2,'DOCUMENT_WORKFLOW_PREVIEW_SOURCE_LOCK '+oldText.slice(0,50));
 modified=modified.replace(oldText,newText);
}
assert.notEqual(modified,before,'DOCUMENT_WORKFLOW_PREVIEW_NOOP');
let restored=modified;
for(const [oldText,newText] of [...replacements].reverse())restored=restored.replace(newText,oldText);
assert.equal(restored,before,'DOCUMENT_WORKFLOW_PREVIEW_NONATOMIC_CHANGE');
await writeFile(EMITTED,modified,'utf8');
const onDisk=await readFile(SOURCE);
assert.equal(onDisk.compare(raw),0,'PROTECTED_CLIENT_DOCUMENTS_SOURCE_WAS_CHANGED');
console.log('QA_DOCUMENT_WORKFLOW_UNAVAILABLE_DIST_PREVIEW=PASS',JSON.stringify({
 sourceGitBlob:EXPECTED_GIT_BLOB,
 emittedOnly:true,
 sourceUnchanged:true,
 patchCount:replacements.length,
 canonicalPublishedDocumentLogicUnchanged:true,
 existingSignedUploadGateUnchanged:true,
 visibleWarningBrowserProof:'PENDING_AUTHORIZED_FIXTURE'
}));
