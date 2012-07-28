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



SELECT tag_id, tag_name FROM tags
SELECT COUNT(post_tags_id) FROM post_tags WHERE tag_id=$1


CREATE OR REPLACE FUNCTION public.getTagCount() RETURNS integer AS
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