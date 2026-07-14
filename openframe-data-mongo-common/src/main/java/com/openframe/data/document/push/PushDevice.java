package com.openframe.data.document.push;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "push_devices")
@CompoundIndexes({
        @CompoundIndex(name = "tenant_token_unique", def = "{'tenantId': 1, 'token': 1}", unique = true),
        @CompoundIndex(name = "tenant_user", def = "{'tenantId': 1, 'userId': 1}")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushDevice implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String userId;

    private String token;

    private PushPlatform platform;

    private Instant createdAt;

    private Instant updatedAt;
}
