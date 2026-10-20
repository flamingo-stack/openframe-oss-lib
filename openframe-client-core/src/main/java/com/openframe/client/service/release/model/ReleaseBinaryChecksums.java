package com.openframe.client.service.release.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReleaseBinaryChecksums {
    private String version;
    // SHA-256 of the signed agent executable, keyed by the osType the agent reports (MAC_OS, WINDOWS)
    private Map<String, String> binaries = Map.of();
}
