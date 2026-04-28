package com.openframe.data.document.toolagent;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.openframe.data.document.TenantScoped;
import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@Document(collection = "integrated_tool_agents")
@CompoundIndexes({
        @CompoundIndex(name = "tenantId_key_uniq", def = "{'tenantId': 1, 'key': 1}", unique = true)
})
public class IntegratedToolAgent implements TenantScoped {

    @Id
    @JsonIgnore
    private String id;

    @JsonAlias("id")
    private String key;

    @Indexed
    private String tenantId;

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

    private boolean allowVersionUpdate;
    private boolean allowConfigurationUpdate;

    private ToolAgentStatus status;

    private PublishState publishState;

}