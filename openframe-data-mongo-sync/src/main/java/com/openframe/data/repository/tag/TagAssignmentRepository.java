package com.openframe.data.repository.tag;

import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TagAssignmentRepository extends MongoRepository<TagAssignment, String> {

    List<TagAssignment> findByEntityIdAndEntityType(String entityId, TagEntityType entityType);

    List<TagAssignment> findByTagId(String tagId);

    void deleteByEntityIdAndTagIdAndEntityType(String entityId, String tagId, TagEntityType entityType);

    void deleteByEntityIdAndEntityType(String entityId, TagEntityType entityType);

    List<TagAssignment> findByEntityIdInAndEntityType(List<String> entityIds, TagEntityType entityType);

    List<TagAssignment> findByTagIdIn(List<String> tagIds);

    List<TagAssignment> findByTagIdInAndEntityType(List<String> tagIds, TagEntityType entityType);

    List<TagAssignment> findByTagIdAndEntityType(String tagId, TagEntityType entityType);

    Optional<TagAssignment> findByEntityIdAndTagIdAndEntityType(String entityId, String tagId, TagEntityType entityType);

    List<TagAssignment> findByEntityIdInAndTagIdInAndEntityType(List<String> entityIds, List<String> tagIds, TagEntityType entityType);

    void deleteByTagId(String tagId);

    @Query("{ 'entityType': ?1, 'values': { $in: ?0 } }")
    List<TagAssignment> findByValuesContainingAnyAndEntityType(List<String> values, TagEntityType entityType);

    @Query("{ 'tagId': { $in: ?0 }, 'values': { $in: ?1 }, 'entityType': ?2 }")
    List<TagAssignment> findByTagIdInAndValuesContainingAnyAndEntityType(List<String> tagIds, List<String> values, TagEntityType entityType);
}
