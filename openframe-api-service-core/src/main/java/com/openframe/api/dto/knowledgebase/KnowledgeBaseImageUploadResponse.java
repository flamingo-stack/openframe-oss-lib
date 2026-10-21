package com.openframe.api.dto.knowledgebase;

import java.util.Map;

// url never expires; uploadUrl/uploadHeaders are short-lived for the single PUT
public record KnowledgeBaseImageUploadResponse(
        String url,
        String uploadUrl,
        Map<String, String> uploadHeaders
) {
}
