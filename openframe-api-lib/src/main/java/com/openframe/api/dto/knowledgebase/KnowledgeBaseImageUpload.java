package com.openframe.api.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseImage;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeBaseImageUpload {
    private KnowledgeBaseImage image;
    private String uploadUrl;
    /** Value the client must send as {@code x-goog-content-length-range} on the PUT. */
    private String contentLengthRange;
}
