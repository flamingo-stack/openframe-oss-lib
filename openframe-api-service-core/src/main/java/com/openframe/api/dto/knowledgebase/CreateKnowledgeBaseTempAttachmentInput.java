package com.openframe.api.dto.knowledgebase;

import jakarta.validation.constraints.NotBlank;
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
    private Long fileSize;
}
