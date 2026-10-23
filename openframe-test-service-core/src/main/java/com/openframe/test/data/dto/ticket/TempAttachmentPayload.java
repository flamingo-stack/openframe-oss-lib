package com.openframe.test.data.dto.ticket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.test.data.dto.knowledgebase.TempAttachment;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** Result of {@code createTempAttachmentUploadUrl}; the temp attachment carries the presigned upload URL. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TempAttachmentPayload {
    private TempAttachment tempAttachment;
    private List<TicketUserError> userErrors;
}
