const asArray=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'').trim();

export function projectAdminClients(authoritativeClients,ownerClients,currentContracts){
  const ownerByClient=new Map(asArray(ownerClients).map(row=>[text(row?.client_id),row]).filter(([id])=>id));
  const contractByClient=new Map();
  for(const row of asArray(currentContracts)){
    const id=text(row?.client_id);
    if(id&&!contractByClient.has(id))contractByClient.set(id,row);
  }
  const seen=new Set(),out=[];
  for(const source of asArray(authoritativeClients)){
    const id=text(source?.client_id);
    if(!id||seen.has(id))continue;
    seen.add(id);
    const owner=ownerByClient.get(id)||{},contract=contractByClient.get(id)||{};
    out.push({
      ...owner,
      ...source,
      client_id:id,
      legal_name:source?.legal_name??owner?.legal_name??null,
      registration_country:source?.registration_country??owner?.registration_country??null,
      registered_address:source?.registered_address??owner?.registered_address??null,
      contract_id:owner?.contract_id??contract?.contract_id??null,
      current_external_contract_number:owner?.current_external_contract_number??contract?.current_external_contract_number??null,
      contract_status:owner?.contract_status??contract?.contract_status??null,
      agent_person_id:owner?.agent_person_id??null,
      agent_name:owner?.agent_name??null
    });
  }
  return out;
}
