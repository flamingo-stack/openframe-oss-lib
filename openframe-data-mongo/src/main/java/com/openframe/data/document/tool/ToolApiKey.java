package com.openframe.data.document.tool;

import com.openframe.data.document.apikey.APIKeyType;
import lombok.Data;

@Data
public class ToolApiKey {
    private String key;
    private APIKeyType type;
    private String keyName;
}
