-- Retire pre-assignment correction RPC from the initial production activation.
revoke all on function public.rona_admin_agent_rewards_correct_v1(text,jsonb,text,text) from public,anon,authenticated;
drop function if exists public.rona_admin_agent_rewards_correct_v1(text,jsonb,text,text);
