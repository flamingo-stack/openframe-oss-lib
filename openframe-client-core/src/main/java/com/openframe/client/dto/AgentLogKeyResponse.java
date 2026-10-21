package com.openframe.client.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Builder
@Getter
public class AgentLogKeyResponse {

    private String key;
    private Instant createdAt;

}
