package com.openframe.api.dto.knowledgebase;

import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemCursor;

/**
 * The opaque cursor of a knowledge base item — one encoding for the page info the service builds
 * and the edges the GraphQL mapper builds, so an edge cursor and endCursor of the same item match.
 */
public final class KnowledgeBaseCursors {

    private KnowledgeBaseCursors() {
    }

    public static String encode(KnowledgeBaseItem item) {
        return CursorCodec.encode(KnowledgeBaseItemCursor.of(item).serialize());
    }
}
