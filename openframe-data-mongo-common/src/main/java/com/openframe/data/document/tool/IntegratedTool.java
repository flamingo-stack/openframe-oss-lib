package com.openframe.data.document.tool;
import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "integrated_tools")
@CompoundIndex(name = "tenant_key_idx", def = "{'tenantId':1,'key':1}", unique = true, sparse = true)
public class IntegratedTool implements TenantScoped {
    @Id
    private String id;
    private String tenantId;
    private String key;
    private String name;
    private String description;
    private String icon;
    private List<ToolUrl> toolUrls;
    private String type;
    private String toolType;
    private String category;
    private String platformCategory;
    private boolean enabled;
    private ToolCredentials credentials;
    // Layer information
    private String layer;
    private Integer layerOrder;
    private String layerColor;
    // Monitoring configuration
    private String metricsPath;
    private String healthCheckEndpoint;
    private Integer healthCheckInterval;
    private Integer connectionTimeout;
    private Integer readTimeout;
    private String[] allowedEndpoints;
    private Object[] debeziumConnectors;

    public String apiUrl() {
        if (toolUrls == null || toolUrls.isEmpty()) {
            throw new IllegalStateException("Integrated tool has no configured URLs: " + key);
        }
        ToolUrl api = toolUrls.stream()
                .filter(u -> u.getType() == ToolUrlType.API)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Integrated tool has no API URL: " + key));
        String port = api.getPort();
        return (port == null || port.isBlank()) ? api.getUrl() : api.getUrl() + ":" + port;
    }

    public String apiToken() {
        ToolApiKey apiKey = credentials == null ? null : credentials.getApiKey();
        String value = apiKey == null ? null : apiKey.getKey();
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Integrated tool has no API token configured: " + key);
        }
        return value;
    }
}
