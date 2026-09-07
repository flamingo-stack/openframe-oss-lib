package com.openframe.api.dto.knowledgebase;

import java.util.Map;

// url: permanent image URL to embed in markdown (never expires)
// uploadUrl: short-lived signed URL the client PUTs the file to
// uploadHeaders: headers the client must send on the PUT request verbatim
public record KnowledgeBaseImageUploadResponse(
        String url,
        String uploadUrl,
        Map<String, String> uploadHeaders
) {
}

