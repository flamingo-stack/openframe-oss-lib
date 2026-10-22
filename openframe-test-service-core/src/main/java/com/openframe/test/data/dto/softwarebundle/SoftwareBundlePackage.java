package com.openframe.test.data.dto.softwarebundle;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One catalog package staged in a bundle; empty while the bundle is PENDING, set by submit.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class SoftwareBundlePackage {
    private String packageManager;
    private String packageName;
    private String brewPackageType;
    private String version;
}
