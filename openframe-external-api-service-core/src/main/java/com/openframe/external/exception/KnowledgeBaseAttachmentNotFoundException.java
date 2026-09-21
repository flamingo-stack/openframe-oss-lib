package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;

public class KnowledgeBaseAttachmentNotFoundException extends NotFoundException {
    public KnowledgeBaseAttachmentNotFoundException(String attachmentId) {
        super(ErrorCode.KNOWLEDGE_BASE_ATTACHMENT_NOT_FOUND, "Knowledge base attachment not found: " + attachmentId);
    }
}
