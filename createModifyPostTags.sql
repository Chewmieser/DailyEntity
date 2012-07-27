CREATE OR REPLACE FUNCTION public.modifyPostTags(postid integer, tagid integer) RETURNS void AS
$$
DECLARE
BEGIN    
	IF NOT EXISTS (SELECT post_tags_id FROM post_tags WHERE post_id=$1 AND tag_id=$2) THEN
		INSERT INTO post_tags (post_id, tag_id) VALUES($1, $2);
	END IF;
END
$$
LANGUAGE 'plpgsql'
VOLATILE
CALLED ON NULL INPUT
SECURITY INVOKER;