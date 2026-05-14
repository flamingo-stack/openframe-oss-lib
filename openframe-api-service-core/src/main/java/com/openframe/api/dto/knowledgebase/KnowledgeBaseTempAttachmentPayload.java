package com.openframe.api.dto.knowledgebase;

import com.openframe.api.dto.shared.MutationError;
import com.openframe.data.document.ticket.TempAttachment;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeBaseTempAttachmentPayload {
    private TempAttachment tempAttachment;
    @Builder.Default
    private List<MutationError> userErrors = List.of();

    public static KnowledgeBaseTempAttachmentPayload success(TempAttachment tempAttachment) {
        return KnowledgeBaseTempAttachmentPayload.builder()
                .tempAttachment(tempAttachment)
                .build();
    }

    public static KnowledgeBaseTempAttachmentPayload error(String message) {
        return KnowledgeBaseTempAttachmentPayload.builder()
                .userErrors(List.of(MutationError.builder().message(message).build()))
                .build();
    }
}
