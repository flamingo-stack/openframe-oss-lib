package com.openframe.test.data.dto.script;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A script environment variable. Doubles as the {@code ScriptEnvVarInput} payload
 * for create/update mutations (identical {@code name}/{@code value}/{@code secret} shape).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScriptEnvVar {
    private String name;
    private String value;
    private Boolean secret;
}
