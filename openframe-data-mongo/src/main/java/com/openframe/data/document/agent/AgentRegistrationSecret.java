package com.openframe.data.document.agent;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "agent_registration_secrets")
public class AgentRegistrationSecret {

    @Id
    private String id;

    @Indexed(unique = true)
    private String secretKey;

    private Instant createdAt;

    private boolean active;

}