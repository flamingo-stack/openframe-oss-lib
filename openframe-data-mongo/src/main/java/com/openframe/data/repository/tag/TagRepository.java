package com.openframe.data.repository.tag;

import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagEntityType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TagRepository extends MongoRepository<Tag, String> {

    List<Tag> findByEntityType(TagEntityType entityType);

    Tag findByKeyAndEntityType(String key, TagEntityType entityType);

    List<Tag> findByKeyInAndEntityType(List<String> keys, TagEntityType entityType);

    boolean existsByKeyAndEntityType(String key, TagEntityType entityType);

    List<Tag> findByEntityTypeAndKeyContainingIgnoreCase(TagEntityType entityType, String key);

    @Query(value = "{ 'key': ?0, 'entityType': ?1 }", fields = "{ 'values': 1 }")
    Tag findValuesByKeyAndEntityType(String key, TagEntityType entityType);
}
