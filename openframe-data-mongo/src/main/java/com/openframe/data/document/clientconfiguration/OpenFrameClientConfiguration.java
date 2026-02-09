package com.openframe.data.document.clientconfiguration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "openframe_client_configuration")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OpenFrameClientConfiguration {

    @Id
    private String id;
    private String version;
    private List<DownloadConfiguration> downloadConfiguration;
    
    @CreatedDate
    private LocalDateTime createdAt;
    
    @LastModifiedDate
    private LocalDateTime updatedAt;

    private boolean updateMessagePublished;
    private Instant updateMessagePublishedAt;

}
