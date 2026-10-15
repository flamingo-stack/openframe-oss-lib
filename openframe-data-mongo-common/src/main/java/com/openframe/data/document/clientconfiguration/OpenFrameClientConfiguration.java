package com.openframe.data.document.clientconfiguration;
import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
@Document(collection = "openframe_client_configuration")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OpenFrameClientConfiguration implements TenantScoped {
    @Id
    private String id;
    @Indexed(unique = true)
    private String tenantId;
    @Version
    private Long documentVersion;
    private String version;
    private List<DownloadConfiguration> downloadConfiguration;
    // the switches every client of the tenant runs with; absent on documents written before the flags existed
    private Map<String, ClientFeatureFlag> featureFlags;
    @CreatedDate
    private LocalDateTime createdAt;
    @LastModifiedDate
    private LocalDateTime updatedAt;
    private PublishState publishState;
}
