package com.openframe.client.dto.agent;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClientFeatureFlagResponse {

    private String name;
    private boolean enabled;
    private String minVersion;
}
