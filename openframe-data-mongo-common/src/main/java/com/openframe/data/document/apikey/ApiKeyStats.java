package com.openframe.data.document.apikey;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "api_key_stats")
public class ApiKeyStats implements TenantScoped {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private Long totalRequests;
    private Long successfulRequests;
    private Long failedRequests;
    private LocalDateTime lastUsed;
} 
