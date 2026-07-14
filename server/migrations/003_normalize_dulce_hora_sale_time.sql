update sales_documents
set sale_date = ((raw_data->>'fechaevento')::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date,
    sale_time = ((raw_data->>'fechaevento')::timestamptz at time zone 'America/Argentina/Buenos_Aires')::time
where source = 'dulce-hora-panel'
  and raw_data ? 'fechaevento'
  and raw_data->>'fechaevento' ~ '^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$';
