package com.openframe.test.data.dto.script;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A saved RMM script as exposed by the {@code scripts}/{@code script} GraphQL API
 * (openframe-api-service-core {@code script.graphqls}). The {@code id} is a Relay
 * node id, and {@code shell}/{@code supportedPlatforms}/{@code status} carry the
 * schema enum names (e.g. {@code POWERSHELL}, {@code WINDOWS}, {@code ACTIVE}).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class Script {
    private String id;
    private String name;
    private String description;
    private String shell;
    private String privilegeLevel;
    private String scriptBody;
    private List<String> supportedPlatforms;
    private Integer defaultTimeoutSeconds;
    private List<String> defaultArgs;
    private List<ScriptEnvVar> envVars;
    private String status;
    private String createdAt;
    private String updatedAt;
    private ScriptAuthor author;
}
