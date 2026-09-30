package com.openframe.test.data.dto.packagesearch;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One searchPackages hit: id (plus packageType for BREW) is what packageDetails takes; publisher is WINGET-only, iconUrl CHOCO-only.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageSearchItem {
    private String id;
    private String name;
    private String version;
    private String publisher;
    private String iconUrl;
    private String installCommand;
    private String packageType;
    private Integer popularity;
    private String packageManager;
}
