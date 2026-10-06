package com.openframe.test.data.dto.softwarebundle;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// submitSoftwareBundle input; id is the SoftwareBundle global id, and no schedule means run now.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubmitSoftwareBundleInput {
    private String id;
    private String action;
    private List<SoftwarePackageInput> packages;
}
