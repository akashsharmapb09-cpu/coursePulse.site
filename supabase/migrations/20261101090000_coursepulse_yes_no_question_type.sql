-- Add the Yes/No question type while keeping validation inside the database transaction.
-- Existing question definitions remain valid and need no data rewrite.
do $$
declare
  v_definition text;
  v_needle text := $needle$      when 'single_choice' then$needle$;
  v_replacement text := $replacement$      when 'yes_no' then
        if jsonb_typeof(v_value) <> 'string' or v_value #>> '{}' not in ('Yes', 'No') then
          raise exception 'Yes/No answers must be Yes or No' using errcode = '22023';
        end if;
      when 'single_choice' then$replacement$;
begin
  select pg_get_functiondef('private.submit_anonymous_feedback(uuid,jsonb)'::regprocedure)
  into v_definition;

  if position(v_needle in v_definition) = 0 then
    raise exception 'Could not locate single-choice validation in anonymous submission function';
  end if;
  if position('when ''yes_no'' then' in v_definition) > 0 then
    raise exception 'Yes/No validation already exists; refusing to apply twice';
  end if;

  v_definition := replace(v_definition, v_needle, v_replacement);
  execute v_definition;
end;
$$;
