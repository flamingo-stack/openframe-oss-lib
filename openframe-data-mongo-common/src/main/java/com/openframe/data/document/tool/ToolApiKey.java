package com.openframe.data.document.tool;

import com.openframe.data.document.apikey.APIKeyType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolApiKey {
    private String key;
    private APIKeyType type;
    private String keyName;
}

