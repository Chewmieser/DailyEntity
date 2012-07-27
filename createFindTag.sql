CREATE OR REPLACE FUNCTION public.findTag(tname text) RETURNS integer AS
$$
DECLARE
	tempvar integer;
BEGIN    
	IF EXISTS (SELECT tag_id FROM tags WHERE tag_name=$1) THEN
		SELECT tag_id INTO tempvar FROM tags WHERE tag_name=$1;
	ELSE
		INSERT INTO tags (tag_name, tag_description) VALUES($1,'') RETURNING tag_id INTO tempvar;
	END IF;

	RETURN tempvar;
END
$$
LANGUAGE plpgsql
VOLATILE
CALLED ON NULL INPUT
SECURITY INVOKER;