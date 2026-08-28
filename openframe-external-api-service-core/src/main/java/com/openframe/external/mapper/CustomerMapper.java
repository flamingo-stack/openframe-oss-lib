package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.OrganizationResponse;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationStatusRequest;
import com.openframe.data.document.organization.Organization;
import com.openframe.external.dto.customer.CreateCustomerRequest;
import com.openframe.external.dto.customer.CustomerResponse;
import com.openframe.external.dto.customer.CustomersResponse;
import com.openframe.external.dto.customer.UpdateCustomerRequest;
import com.openframe.external.dto.customer.UpdateCustomerStatusRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * External representation of the organization domain under its product name, Customer. The
 * external id IS the business organizationId — the Mongo ObjectId never leaves the service, so
 * there is exactly one id concept in the external contract.
 */
@Component
@RequiredArgsConstructor
public class CustomerMapper extends BaseRestMapper {

    private final com.openframe.api.mapper.OrganizationMapper sharedMapper;

    public CustomerResponse toResponse(Organization organization) {
        OrganizationResponse response = sharedMapper.toResponse(organization);
        if (response == null) {
            return null;
        }
        return CustomerResponse.builder()
                .id(response.getOrganizationId())
                .name(response.getName())
                .category(response.getCategory())
                .numberOfEmployees(response.getNumberOfEmployees())
                .websiteUrl(response.getWebsiteUrl())
                .notes(response.getNotes())
                .contactInformation(response.getContactInformation())
                .monthlyRevenue(response.getMonthlyRevenue())
                .contractStartDate(response.getContractStartDate())
                .contractEndDate(response.getContractEndDate())
                .createdAt(response.getCreatedAt())
                .updatedAt(response.getUpdatedAt())
                .lastActivityAt(response.getLastActivityAt())
                .isDefault(response.getIsDefault())
                .status(response.getStatus())
                .statusChangedAt(response.getStatusChangedAt())
                .build();
    }

    public CustomersResponse toCustomersResponse(CountedGenericQueryResult<Organization> queryResult) {
        List<CustomerResponse> customers = queryResult.getItems().stream()
                .map(this::toResponse)
                .toList();
        return CustomersResponse.builder()
                .customers(customers)
                .filteredCount(queryResult.getFilteredCount())
                .pageInfo(queryResult.getPageInfo())
                .build();
    }

    public CreateOrganizationRequest toCreateRequest(CreateCustomerRequest request) {
        return CreateOrganizationRequest.builder()
                .name(request.name())
                .category(request.category())
                .numberOfEmployees(request.numberOfEmployees())
                .websiteUrl(request.websiteUrl())
                .notes(request.notes())
                .contactInformation(request.contactInformation())
                .monthlyRevenue(request.monthlyRevenue())
                .contractStartDate(request.contractStartDate())
                .contractEndDate(request.contractEndDate())
                .build();
    }

    public UpdateOrganizationRequest toUpdateRequest(UpdateCustomerRequest request) {
        return UpdateOrganizationRequest.builder()
                .name(request.name())
                .category(request.category())
                .numberOfEmployees(request.numberOfEmployees())
                .websiteUrl(request.websiteUrl())
                .notes(request.notes())
                .contactInformation(request.contactInformation())
                .monthlyRevenue(request.monthlyRevenue())
                .contractStartDate(request.contractStartDate())
                .contractEndDate(request.contractEndDate())
                .build();
    }

    public UpdateOrganizationStatusRequest toStatusRequest(UpdateCustomerStatusRequest request) {
        return new UpdateOrganizationStatusRequest(
                UpdateOrganizationStatusRequest.OrganizationStatusAction.valueOf(request.status().name()));
    }
}
