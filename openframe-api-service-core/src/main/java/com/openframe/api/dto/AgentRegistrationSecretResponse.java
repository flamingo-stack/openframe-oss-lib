package com.openframe.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AgentRegistrationSecretResponse {

    private String id;
    private String key;
    private Instant createdAt;
    private boolean active;

} 
