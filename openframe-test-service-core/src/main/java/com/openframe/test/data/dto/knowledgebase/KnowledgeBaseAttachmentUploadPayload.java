package com.openframe.test.data.dto.knowledgebase;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.shared.MutationError;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeBaseAttachmentUploadPayload {
    private KnowledgeBaseItemAttachment attachment;
    private String uploadUrl;
    private List<MutationError> userErrors;
}