package com.openframe.data.repository.tag;

import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagEntityType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TagRepository extends MongoRepository<Tag, String> {
    List<Tag> findByOrganizationId(String organizationId);

    List<Tag> findByOrganizationIdAndEntityType(String organizationId, TagEntityType entityType);

    Tag findByKeyAndOrganizationId(String key, String organizationId);

    List<Tag> findByKeyIn(List<String> keys);

    List<Tag> findByKeyInAndEntityType(List<String> keys, TagEntityType entityType);

    boolean existsByKeyAndOrganizationId(String key, String organizationId);

    List<Tag> findByOrganizationIdAndKeyContainingIgnoreCase(String organizationId, String key);

    List<Tag> findByOrganizationIdAndEntityTypeAndKeyContainingIgnoreCase(String organizationId, TagEntityType entityType, String key);

    @Query(value = "{ 'key': ?0, 'organizationId': ?1 }", fields = "{ 'values': 1 }")
    Tag findValuesByKeyAndOrganizationId(String key, String organizationId);

    @Query(value = "{ 'key': ?0, 'organizationId': ?1, 'entityType': ?2 }", fields = "{ 'values': 1 }")
    Tag findValuesByKeyAndOrganizationIdAndEntityType(String key, String organizationId, TagEntityType entityType);
}
