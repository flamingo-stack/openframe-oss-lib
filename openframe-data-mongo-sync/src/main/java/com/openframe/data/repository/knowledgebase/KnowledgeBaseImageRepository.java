package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseImage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface KnowledgeBaseImageRepository extends MongoRepository<KnowledgeBaseImage, String> {

    /**
     * Tenant-scoped id lookup. Deliberately a derived query rather than {@link #findById}:
     * derived queries run through {@code TenantAwareMongoTemplate}'s {@code query()} proxy, which
     * injects the {@code tenantId} criterion, while {@code findById} bypasses it. Image ids are
     * embedded in article/ticket markdown, so on a shared database an unscoped lookup would serve
     * another tenant's image to anyone holding its id.
     */
    Optional<KnowledgeBaseImage> findOneById(String id);
}
