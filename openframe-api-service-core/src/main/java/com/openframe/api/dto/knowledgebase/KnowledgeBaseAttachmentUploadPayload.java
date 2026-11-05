package com.openframe.api.dto.knowledgebase;

import com.openframe.api.dto.shared.MutationError;
import com.openframe.core.dto.HasUserErrors;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeBaseAttachmentUploadPayload implements HasUserErrors {
    private KnowledgeBaseItemAttachment attachment;
    private String uploadUrl;
    @Builder.Default
    private List<MutationError> userErrors = List.of();

    public static KnowledgeBaseAttachmentUploadPayload success(KnowledgeBaseItemAttachment attachment, String uploadUrl) {
        return KnowledgeBaseAttachmentUploadPayload.builder()
                .attachment(attachment)
                .uploadUrl(uploadUrl)
                .build();
    }

    public static KnowledgeBaseAttachmentUploadPayload error(String message) {
        return KnowledgeBaseAttachmentUploadPayload.builder()
                .userErrors(List.of(MutationError.builder().message(message).build()))
                .build();
    }

    @Override
    public List<String> userErrorMessages() {
        return userErrors.stream().map(MutationError::getMessage).toList();
    }
}
