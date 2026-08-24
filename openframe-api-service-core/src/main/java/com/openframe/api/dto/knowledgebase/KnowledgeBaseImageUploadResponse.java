package com.openframe.api.dto.knowledgebase;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * url           permanent image URL to embed in markdown (never expires)
 * uploadUrl     short-lived signed URL the client PUTs the file to
 * uploadHeaders headers the client must send on the PUT request verbatim
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeBaseImageUploadResponse {
    private String url;
    private String uploadUrl;
    private Map<String, String> uploadHeaders;
}

