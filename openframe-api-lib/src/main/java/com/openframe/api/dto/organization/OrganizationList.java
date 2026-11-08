package com.openframe.api.dto.organization;

import com.openframe.data.document.organization.Organization;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO for organization list response.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizationList {
    private List<Organization> organizations;
}
