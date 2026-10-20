package com.openframe.client.service.release.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class GitHubReleaseAsset {
    private String name;
    // API url of the asset; downloading it answers with a redirect to short-lived storage
    private String url;
}
