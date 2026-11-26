package com.openframe.api.dto.knowledgebase;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateKnowledgeBaseTempAttachmentInput {
    @NotBlank
    private String fileName;
    private String contentType;
    @PositiveOrZero
    private Long fileSize;
}
