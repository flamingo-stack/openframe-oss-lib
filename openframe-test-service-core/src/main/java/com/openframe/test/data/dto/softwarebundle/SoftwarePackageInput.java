package com.openframe.test.data.dto.softwarebundle;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One catalog package to submit, identified as package search returns it; brewPackageType is BREW-only.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SoftwarePackageInput {
    private String packageManager;
    private String packageName;
    private String brewPackageType;
}
