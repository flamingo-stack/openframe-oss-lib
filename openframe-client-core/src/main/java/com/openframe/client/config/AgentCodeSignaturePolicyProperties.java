package com.openframe.client.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.agent.code-signature-policy")
public class AgentCodeSignaturePolicyProperties {

    // Off unless a deployment opts in: local and dev agent builds are unsigned
    private CodeSignaturePolicyMode mode = CodeSignaturePolicyMode.DISABLED;
    // Keyed by the osType the agent reports (MAC_OS, WINDOWS); an OS without entries is not checked
    private Map<String, List<String>> trustedSigners = new HashMap<>();

    public List<String> trustedSignersFor(String osType) {
        return trustedSigners.getOrDefault(osType, List.of());
    }
}
