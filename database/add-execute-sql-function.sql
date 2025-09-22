-- Create function to execute dynamic SQL safely
-- This function allows report queries to be executed dynamically
-- with some safety restrictions

CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS TABLE(result JSONB) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Basic safety checks - prevent dangerous operations
  IF sql_query ~* '\b(DELETE|UPDATE|INSERT|DROP|CREATE|ALTER|TRUNCATE)\b' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed in reports';
  END IF;
  
  -- Limit to reasonable query length
  IF LENGTH(sql_query) > 10000 THEN
    RAISE EXCEPTION 'Query too long - maximum 10,000 characters';
  END IF;
  
  -- Execute the query and return results as JSONB
  RETURN QUERY
  EXECUTE 'SELECT to_jsonb(t) FROM (' || sql_query || ') t';
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;