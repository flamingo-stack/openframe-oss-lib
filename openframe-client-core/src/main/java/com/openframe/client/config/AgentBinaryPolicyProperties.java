package com.openframe.client.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.agent.binary-policy")
public class AgentBinaryPolicyProperties {

    // Off unless a deployment opts in: local and dev agent builds are not published releases
    private AgentBinaryPolicyMode mode = AgentBinaryPolicyMode.DISABLED;
    private ReleaseSource releases = new ReleaseSource();

    @Getter
    @Setter
    public static class ReleaseSource {
        private String owner;
        private String repository;
        // read access to the repository's releases; may be empty for a public repository
        private String token;
    }
}
