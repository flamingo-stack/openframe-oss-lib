package com.openframe.data.repository.tool;

import com.openframe.data.document.tool.Tag;
import com.openframe.data.document.tool.TagType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TagRepository extends MongoRepository<Tag, String> {
    List<Tag> findByOrganizationId(String organizationId);

    Tag findByKeyAndOrganizationId(String key, String organizationId);

    List<Tag> findByKeyIn(List<String> keys);

    List<Tag> findByOrganizationIdAndTypeIn(String organizationId, List<TagType> types);

    List<Tag> findByTypeIn(List<TagType> types);

    boolean existsByKeyAndOrganizationId(String key, String organizationId);
}
