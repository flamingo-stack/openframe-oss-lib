package com.openframe.documents.tool;

import lombok.Data;

@Data
public class ToolCredentials {
    private String username;
    private String password;
    private ToolApiKey apiKey;
} 