package com.openframe.data.repository.tool;

import com.openframe.data.document.tool.Tag;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TagRepository extends MongoRepository<Tag, String> {
    List<Tag> findByOrganizationId(String organizationId);

    Tag findByKeyAndOrganizationId(String key, String organizationId);

    List<Tag> findByKeyIn(List<String> keys);

    boolean existsByKeyAndOrganizationId(String key, String organizationId);

    List<Tag> findByOrganizationIdAndKeyContainingIgnoreCase(String organizationId, String key);

    @Query(value = "{ 'key': ?0, 'organizationId': ?1 }", fields = "{ 'values': 1 }")
    Tag findValuesByKeyAndOrganizationId(String key, String organizationId);
}
