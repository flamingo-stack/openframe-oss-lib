package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class KnowledgeBaseItemNotFoundException extends NotFoundException {
    public KnowledgeBaseItemNotFoundException(String itemId) {
        super(ErrorCode.KNOWLEDGE_BASE_ITEM_NOT_FOUND, "Knowledge base item not found: " + itemId);
    }
}
