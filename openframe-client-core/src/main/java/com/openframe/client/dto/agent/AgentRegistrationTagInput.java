package com.openframe.client.dto.agent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Tag to be created and assigned to a device during agent registration.
 * If a tag with the given key doesn't exist in the organization, it will be auto-created as CUSTOM.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentRegistrationTagInput {
    private String key;            // tag key name (e.g., "site")
    private List<String> values;   // values to assign (e.g., ["CHICAGO"])
}
