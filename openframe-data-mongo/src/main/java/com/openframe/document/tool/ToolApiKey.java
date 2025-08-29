package com.openframe.document.tool;

import com.openframe.document.apikey.APIKeyType;
import lombok.Data;

@Data
public class ToolApiKey {
    private String key;
    private APIKeyType type;
    private String keyName;
}
