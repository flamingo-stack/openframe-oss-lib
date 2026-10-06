package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class KnowledgeBaseTagNotFoundException extends NotFoundException {
    public KnowledgeBaseTagNotFoundException(String tagId) {
        super(ErrorCode.TAG_NOT_FOUND, "Tag not found: " + tagId);
    }
}
