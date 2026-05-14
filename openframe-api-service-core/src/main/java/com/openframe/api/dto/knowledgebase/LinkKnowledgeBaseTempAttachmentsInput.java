package com.openframe.api.dto.knowledgebase;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LinkKnowledgeBaseTempAttachmentsInput {
    @NotBlank
    private String articleId;
    @NotEmpty
    @Size(max = 50)
    private List<String> tempIds;
}
