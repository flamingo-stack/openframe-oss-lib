package com.openframe.client.dto.agent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientFeatureFlagResponse {

    private String name;
    private boolean enabled;
    private String minVersion;
}
