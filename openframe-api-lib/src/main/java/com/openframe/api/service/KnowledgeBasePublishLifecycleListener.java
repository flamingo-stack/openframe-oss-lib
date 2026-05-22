package com.openframe.api.service;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Stamps {@link KnowledgeBaseItem#getPublishedAt()} on the first save where the
 * item is in {@link KnowledgeBaseArticleStatus#PUBLISHED}. Once set, the
 * timestamp is never overwritten — subsequent unpublish/republish or
 * archive/unarchive cycles preserve the original publication moment.
 *
 * <p>Matches the canonical "first published at" semantic of Schema.org
 * {@code datePublished} and Atom RFC 4287 {@code atom:published}.
 */
@Component
public class KnowledgeBasePublishLifecycleListener
        extends AbstractMongoEventListener<KnowledgeBaseItem> {

    @Override
    public void onBeforeConvert(BeforeConvertEvent<KnowledgeBaseItem> event) {
        KnowledgeBaseItem item = event.getSource();
        if (item.getStatus() == KnowledgeBaseArticleStatus.PUBLISHED
                && item.getPublishedAt() == null) {
            item.setPublishedAt(Instant.now());
        }
    }
}
