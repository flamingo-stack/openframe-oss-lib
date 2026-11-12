package com.openframe.client.dto.agent;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgentFeatureFlagsResponse {

    private Map<String, ClientFeatureFlag> flags;
}
