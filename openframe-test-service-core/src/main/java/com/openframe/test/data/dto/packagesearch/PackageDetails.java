package com.openframe.test.data.dto.packagesearch;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// packageDetails answer; versions are newest first.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class PackageDetails {
    private String id;
    private String packageManager;
    private String name;
    private String publisher;
    private String installCommand;
    private String packageType;
    private Integer popularity;
    private List<String> tags;
    private List<PackageVersion> versions;
}
