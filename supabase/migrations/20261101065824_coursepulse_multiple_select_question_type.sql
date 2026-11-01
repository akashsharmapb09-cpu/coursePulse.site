-- Reuse the existing server-side array validation for the explicit Multiple selection control.
-- The stored answer remains an array of allowed option strings.
do $$
declare
  v_definition text;
  v_needle text := $needle$      when 'multiple_choice' then$needle$;
  v_replacement text := $replacement$      when 'multiple_choice', 'multiple_select' then$replacement$;
begin
  select pg_get_functiondef('private.submit_anonymous_feedback(uuid,jsonb)'::regprocedure)
  into v_definition;

  if position(v_needle in v_definition) = 0 then
    raise exception 'Could not locate multiple-choice validation in anonymous submission function';
  end if;
  if position('when ''multiple_choice'', ''multiple_select'' then' in v_definition) > 0 then
    raise exception 'Multiple selection validation already exists; refusing to apply twice';
  end if;

  v_definition := replace(v_definition, v_needle, v_replacement);
  execute v_definition;
end;
$$;
