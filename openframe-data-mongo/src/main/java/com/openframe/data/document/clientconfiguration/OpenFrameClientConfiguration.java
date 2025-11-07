package com.openframe.data.document.clientconfiguration;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "openframe_client_configuration")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OpenFrameClientConfiguration {
    @Id
    private String id;
    private String version;
    private DownloadLinkData downloadLinkData;

}
