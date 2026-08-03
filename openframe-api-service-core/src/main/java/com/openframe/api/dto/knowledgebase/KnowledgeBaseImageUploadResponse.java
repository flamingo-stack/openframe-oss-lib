package com.openframe.api.dto.knowledgebase;

import java.util.Map;

/**
 * @param url           permanent image URL to embed in markdown (never expires)
 * @param uploadUrl     short-lived signed URL the client PUTs the file to
 * @param uploadHeaders headers the client must send on the PUT request verbatim
 */
public record KnowledgeBaseImageUploadResponse(
        String url,
        String uploadUrl,
        Map<String, String> uploadHeaders
) {
}
