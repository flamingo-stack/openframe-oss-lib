package com.openframe.data.document.toolagent;
import com.openframe.data.document.TenantScoped;
import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;
@Data
@Document(collection = "integrated_tool_agents")
@CompoundIndex(name = "tenant_key_idx", def = "{'tenantId':1,'key':1}", unique = true, sparse = true)
public class IntegratedToolAgent implements TenantScoped {
    @Id
    private String id;
    @Indexed
    private String tenantId;
    @Indexed
    private String key;
    @Version
    private Long documentVersion;
    private String toolId;
    private boolean releaseVersion;
    private String version;
    private SessionType sessionType;
    private List<DownloadConfiguration> downloadConfigurations;
    private List<ToolAgentAsset> assets;
    private List<String> installationCommandArgs;
    private List<String> runCommandArgs;
    private List<String> agentToolIdCommandArgs;
    private List<String> uninstallationCommandArgs;
    private ToolAgentStatus status;
    private PublishState publishState;
}
