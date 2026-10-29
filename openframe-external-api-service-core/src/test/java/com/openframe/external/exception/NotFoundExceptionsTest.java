package com.openframe.external.exception;

import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class NotFoundExceptionsTest {

    @Test
    void customerNotFoundCarriesItsCodeAndTheId() {
        assertNotFound(new CustomerNotFoundException("cust-1"),
                ErrorCode.CUSTOMER_NOT_FOUND, "CUSTOMER_NOT_FOUND", "Customer not found: cust-1");
    }

    @Test
    void knowledgeBaseItemNotFoundCarriesItsCodeAndTheId() {
        assertNotFound(new KnowledgeBaseItemNotFoundException("item-1"),
                ErrorCode.KNOWLEDGE_BASE_ITEM_NOT_FOUND, "KNOWLEDGE_BASE_ITEM_NOT_FOUND", "Knowledge base item not found: item-1");
    }

    @Test
    void knowledgeBaseAttachmentNotFoundCarriesItsCodeAndTheId() {
        assertNotFound(new KnowledgeBaseAttachmentNotFoundException("att-1"),
                ErrorCode.KNOWLEDGE_BASE_ATTACHMENT_NOT_FOUND, "KNOWLEDGE_BASE_ATTACHMENT_NOT_FOUND",
                "Knowledge base attachment not found: att-1");
    }

    @Test
    void knowledgeBaseTagNotFoundUsesTheSharedTagCode() {
        assertNotFound(new KnowledgeBaseTagNotFoundException("tag-1"),
                ErrorCode.TAG_NOT_FOUND, "TAG_NOT_FOUND", "Tag not found: tag-1");
    }

    @Test
    void logNotFoundKeepsTheCallerSuppliedMessageVerbatim() {
        assertNotFound(new LogNotFoundException("Log not found for event evt-1"),
                ErrorCode.LOG_NOT_FOUND, "LOG_NOT_FOUND", "Log not found for event evt-1");
    }

    private static void assertNotFound(NotFoundException ex, ErrorCode code, String wireCode, String message) {
        assertEquals(code, ex.getErrorCode());
        assertEquals(wireCode, ex.getErrorCode().getCode());
        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
        assertEquals(message, ex.getMessage());
        assertNull(ex.getCause());
    }
}
