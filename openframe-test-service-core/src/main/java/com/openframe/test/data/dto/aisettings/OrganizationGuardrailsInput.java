package com.openframe.test.data.dto.aisettings;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// templateId is the server id of a TEMPLATE policy from the tenant's policy list
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrganizationGuardrailsInput {
    private String templateId;
    private List<GuardrailOverride> overrides;
}
