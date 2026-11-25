package com.openframe.api.dto.knowledgebase;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class KnowledgeBaseAttachmentInputValidationTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    void validate_attachmentOfNegativeSize_rejected() {
        CreateKnowledgeBaseAttachmentInput input = attachment(-1L);

        assertThat(validator.validate(input))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly("fileSize");
    }

    @Test
    void validate_emptyAttachment_accepted() {
        CreateKnowledgeBaseAttachmentInput input = attachment(0L);

        assertThat(validator.validate(input)).isEmpty();
    }

    @Test
    void validate_tempAttachmentOfNegativeSize_rejected() {
        CreateKnowledgeBaseTempAttachmentInput input = tempAttachment(-1L);

        assertThat(validator.validate(input))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly("fileSize");
    }

    @Test
    void validate_emptyTempAttachment_accepted() {
        CreateKnowledgeBaseTempAttachmentInput input = tempAttachment(0L);

        assertThat(validator.validate(input)).isEmpty();
    }

    private static CreateKnowledgeBaseAttachmentInput attachment(Long fileSize) {
        return CreateKnowledgeBaseAttachmentInput.builder()
                .articleId("article-1")
                .fileName("runbook.pdf")
                .fileSize(fileSize)
                .build();
    }

    private static CreateKnowledgeBaseTempAttachmentInput tempAttachment(Long fileSize) {
        return CreateKnowledgeBaseTempAttachmentInput.builder().fileName("runbook.pdf").fileSize(fileSize).build();
    }
}
