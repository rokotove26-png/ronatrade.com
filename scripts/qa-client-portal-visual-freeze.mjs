import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const POLICY_PATH='governance/client-portal-visual-freeze.json';
const APPLICATIONS_APPROVAL_PATH='governance/client-applications-uat-v2-owner-approval.json';
const policy=JSON.parse(await readFile(POLICY_PATH,'utf8'));
const applicationsApproval=JSON.parse(await readFile(APPLICATIONS_APPROVAL_PATH,'utf8'));

if(policy.policy!=='RONA_CLIENT_PORTAL_VISUAL_FREEZE_V1')throw new Error('CLIENT_VISUAL_FREEZE_POLICY_ID_MISMATCH');
if(policy.status!=='FROZEN')throw new Error('CLIENT_VISUAL_FREEZE_NOT_ACTIVE');
if(policy.owner_instruction_required!==true)throw new Error('CLIENT_VISUAL_FREEZE_OWNER_GATE_DISABLED');
if(!policy.approval_marker||!String(policy.approval_marker).startsWith('OWNER_VISUAL_APPROVAL:'))throw new Error('CLIENT_VISUAL_FREEZE_APPROVAL_MARKER_INVALID');

const applicationExceptionAuthorized=
  applicationsApproval?.approval==='OWNER_IN_CHAT'&&
  applicationsApproval?.authorized_at==='2026-09-04'&&
  applicationsApproval?.scope==='CLIENT_APPLICATIONS_UAT_V2'&&
  applicationsApproval?.requirements?.application_rows_align_to_primary_title_frame===true&&
  applicationsApproval?.requirements?.display_actual_submitted_price===true&&
  applicationsApproval?.requirements?.hide_internal_price_mode_enum_from_client_display===true&&
  applicationsApproval?.requirements?.images_added===false&&
  Array.isArray(applicationsApproval?.requirements?.resource_status_visible)&&
  applicationsApproval.requirements.resource_status_visible.includes('RESOURCE_NOT_CONFIRMED')&&
  applicationsApproval.requirements.resource_status_visible.includes('RESOURCE_CONFIRMED');

const approvedModifiedFiles=new Set(applicationExceptionAuthorized?[
  'assets/portal-runtime/client-applications-live-render-v1.js',
  'scripts/attach-client-applications-live-render-v1.mjs'
]:[]);

const protectedFiles=policy.protected_files||{};
const errors=[];

function gitBlobSha(buffer){
  return createHash('sha1').update(Buffer.from(`blob ${buffer.length}\0`)).update(buffer).digest('hex');
}

for(const [path,expected] of Object.entries(protectedFiles)){
  try{
    const body=await readFile(path);
    const actual=gitBlobSha(body);
    if(actual!==expected&&!approvedModifiedFiles.has(path))errors.push(`MODIFIED ${path} expected=${expected} actual=${actual}`);
  }catch(error){
    errors.push(`MISSING ${path} ${error?.code||error?.message||'READ_ERROR'}`);
  }
}

const baselineRuntime=new Set(Object.keys(protectedFiles)
  .filter(path=>path.startsWith('assets/portal-runtime/client-'))
  .map(path=>path.split('/').pop()));
const currentRuntime=(await readdir('assets/portal-runtime'))
  .filter(name=>/^client-.*\.(?:js|css)$/u.test(name));
for(const name of currentRuntime){
  if(!baselineRuntime.has(name))errors.push(`NEW_CLIENT_RUNTIME assets/portal-runtime/${name}`);
}

const baselineAttach=new Set(Object.keys(protectedFiles)
  .filter(path=>path.startsWith('scripts/attach-client-'))
  .map(path=>path.split('/').pop()));
const currentAttach=(await readdir('scripts'))
  .filter(name=>/^attach-client-.*\.mjs$/u.test(name));
for(const name of currentAttach){
  if(!baselineAttach.has(name))errors.push(`NEW_CLIENT_ATTACHMENT scripts/${name}`);
}

const baselineSource=new Set(Object.keys(protectedFiles)
  .filter(path=>path.startsWith('portal-src/current/client/'))
  .map(path=>path.split('/').pop()));
const currentSource=(await readdir('portal-src/current/client')).sort();
for(const name of currentSource){
  if(!baselineSource.has(name))errors.push(`NEW_CLIENT_SOURCE portal-src/current/client/${name}`);
}

if(errors.length){
  console.error('CLIENT_PORTAL_VISUAL_FREEZE=BLOCKED');
  console.error('Client Portal frontend/visual baseline is frozen. Explicit owner instruction is required before changing the baseline.');
  for(const item of errors)console.error(` - ${item}`);
  process.exit(1);
}

console.log(`CLIENT_PORTAL_VISUAL_FREEZE=PASS baseline=${policy.baseline_release_commit} protected=${Object.keys(protectedFiles).length} applications_owner_exception=${applicationExceptionAuthorized?'approved':'none'}`);
