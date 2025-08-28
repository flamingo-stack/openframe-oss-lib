package com.openframe.documents.tool;

import com.openframe.documents.apikey.APIKeyType;
import lombok.Data;

@Data
public class ToolApiKey {
    private String key;
    private APIKeyType type;
    private String keyName;
}
