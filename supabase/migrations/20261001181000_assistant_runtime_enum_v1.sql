-- RONA Assistant administrative runtime role.
-- ASSISTANT is an administrative AI runtime role, not a business decision owner.
alter type portal_private.ai_business_role_enum add value if not exists 'ASSISTANT';
alter type portal_private.staff_functional_role_enum add value if not exists 'ASSISTANT';
