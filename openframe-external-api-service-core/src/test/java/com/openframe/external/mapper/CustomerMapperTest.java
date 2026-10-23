package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.AddressDto;
import com.openframe.api.dto.organization.ContactInformationDto;
import com.openframe.api.dto.organization.ContactPersonDto;
import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationStatusRequest;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.data.document.organization.Address;
import com.openframe.data.document.organization.ContactInformation;
import com.openframe.data.document.organization.ContactPerson;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.external.dto.customer.CreateCustomerRequest;
import com.openframe.external.dto.customer.CustomerResponse;
import com.openframe.external.dto.customer.CustomersResponse;
import com.openframe.external.dto.customer.UpdateCustomerRequest;
import com.openframe.external.dto.customer.UpdateCustomerStatusRequest;
import com.openframe.external.dto.customer.UpdateCustomerStatusRequest.CustomerStatusAction;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CustomerMapperTest {

    private static final Instant CREATED_AT = Instant.parse("2026-01-02T03:04:05Z");
    private static final Instant UPDATED_AT = Instant.parse("2026-03-04T05:06:07Z");
    private static final Instant STATUS_CHANGED_AT = Instant.parse("2026-03-05T00:00:00Z");
    private static final ContactInformationDto CONTACT_INFORMATION = ContactInformationDto.builder()
            .contacts(List.of(ContactPersonDto.builder().contactName("Jane Doe").title("CTO")
                    .phone("+1 555 0100").email("jane@acme.example").build()))
            .physicalAddress(AddressDto.builder().street1("1 Main St").city("Springfield").country("US").build())
            .mailingAddress(AddressDto.builder().street1("PO Box 7").city("Shelbyville").build())
            .mailingAddressSameAsPhysical(false)
            .build();

    private final CustomerMapper mapper = new CustomerMapper(new OrganizationMapper());

    @Test
    void responseExposesTheBusinessIdAsIdAndEveryScalarField() {
        CustomerResponse response = mapper.toResponse(organization());

        assertEquals("cust-1", response.getId());
        assertEquals("Acme Corporation", response.getName());
        assertEquals("MSP client", response.getCategory());
        assertEquals(42, response.getNumberOfEmployees());
        assertEquals("https://acme.example", response.getWebsiteUrl());
        assertEquals("VIP", response.getNotes());
        assertEquals(new BigDecimal("1500.50"), response.getMonthlyRevenue());
        assertEquals(LocalDate.of(2026, 1, 1), response.getContractStartDate());
        assertEquals(LocalDate.of(2026, 12, 31), response.getContractEndDate());
        assertEquals(CREATED_AT, response.getCreatedAt());
        assertEquals(UPDATED_AT, response.getUpdatedAt());
        assertEquals(Boolean.TRUE, response.getIsDefault());
        assertEquals("ARCHIVED", response.getStatus());
        assertEquals(STATUS_CHANGED_AT, response.getStatusChangedAt());
    }

    @Test
    void responseCarriesNestedContactInformation() {
        ContactInformationDto contactInformation = mapper.toResponse(organization()).getContactInformation();

        assertEquals(1, contactInformation.contacts().size());
        ContactPersonDto contact = contactInformation.contacts().getFirst();
        assertEquals("Jane Doe", contact.contactName());
        assertEquals("CTO", contact.title());
        assertEquals("+1 555 0100", contact.phone());
        assertEquals("jane@acme.example", contact.email());
        assertEquals("1 Main St", contactInformation.physicalAddress().street1());
        assertEquals("Springfield", contactInformation.physicalAddress().city());
        assertEquals("US", contactInformation.physicalAddress().country());
        assertEquals("Shelbyville", contactInformation.mailingAddress().city());
        assertEquals(Boolean.FALSE, contactInformation.mailingAddressSameAsPhysical());
    }

    @Test
    void lastActivityIsUpdatedAtWhenTheCustomerWasEverUpdated() {
        assertEquals(UPDATED_AT, mapper.toResponse(organization()).getLastActivityAt());
    }

    @Test
    void lastActivityFallsBackToCreatedAtForNeverUpdatedCustomer() {
        Organization organization = organization();
        organization.setUpdatedAt(null);

        CustomerResponse response = mapper.toResponse(organization);

        assertNull(response.getUpdatedAt());
        assertEquals(CREATED_AT, response.getLastActivityAt());
    }

    @Test
    void nullOrganizationMapsToNull() {
        assertNull(mapper.toResponse(null));
    }

    @Test
    void sparseOrganizationMapsWithoutContactInformationOrStatus() {
        Organization organization = Organization.builder().organizationId("cust-2").name("Globex").build();
        organization.setStatus(null);

        CustomerResponse response = mapper.toResponse(organization);

        assertEquals("cust-2", response.getId());
        assertEquals("Globex", response.getName());
        assertNull(response.getContactInformation());
        assertNull(response.getStatus());
        assertNull(response.getLastActivityAt());
        assertEquals(Boolean.FALSE, response.getIsDefault());
    }

    @Test
    void newOrganizationIsReportedActiveByDefault() {
        Organization organization = Organization.builder().organizationId("cust-2").build();

        assertEquals("ACTIVE", mapper.toResponse(organization).getStatus());
    }

    @Test
    void customersResponseKeepsOrderCountAndPageInfo() {
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).startCursor("start").endCursor("end").build();
        Organization second = Organization.builder().id("mongo-2").organizationId("cust-2").name("Globex").build();

        CustomersResponse response = mapper.toCustomersResponse(CountedGenericQueryResult.<Organization>builder()
                .items(List.of(organization(), second))
                .pageInfo(pageInfo)
                .filteredCount(12)
                .build());

        assertEquals(List.of("cust-1", "cust-2"), response.getCustomers().stream().map(CustomerResponse::getId).toList());
        assertEquals(12, response.getFilteredCount());
        assertSame(pageInfo, response.getPageInfo());
    }

    @Test
    void emptyPageMapsToEmptyCustomerList() {
        CustomersResponse response = mapper.toCustomersResponse(CountedGenericQueryResult.<Organization>builder()
                .items(List.of())
                .filteredCount(0)
                .build());

        assertTrue(response.getCustomers().isEmpty());
        assertEquals(0, response.getFilteredCount());
        assertNull(response.getPageInfo());
    }

    @Test
    void createRequestBecomesCreateOrganizationCommand() {
        CreateOrganizationRequest command = mapper.toCreateRequest(new CreateCustomerRequest(
                "Acme Corporation", "MSP client", 42, "https://acme.example", "VIP", CONTACT_INFORMATION,
                new BigDecimal("1500.50"), LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)));

        assertEquals(CreateOrganizationRequest.builder()
                .name("Acme Corporation")
                .category("MSP client")
                .numberOfEmployees(42)
                .websiteUrl("https://acme.example")
                .notes("VIP")
                .contactInformation(CONTACT_INFORMATION)
                .monthlyRevenue(new BigDecimal("1500.50"))
                .contractStartDate(LocalDate.of(2026, 1, 1))
                .contractEndDate(LocalDate.of(2026, 12, 31))
                .build(), command);
        assertSame(CONTACT_INFORMATION, command.contactInformation());
    }

    @Test
    void createRequestWithOnlyNameLeavesTheRestNull() {
        CreateOrganizationRequest command = mapper.toCreateRequest(
                new CreateCustomerRequest("Acme", null, null, null, null, null, null, null, null));

        assertEquals(CreateOrganizationRequest.builder().name("Acme").build(), command);
    }

    @Test
    void updateRequestBecomesUpdateOrganizationCommand() {
        UpdateOrganizationRequest command = mapper.toUpdateRequest(new UpdateCustomerRequest(
                "Acme Corporation", "MSP client", 42, "https://acme.example", "VIP", CONTACT_INFORMATION,
                new BigDecimal("1500.50"), LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)));

        assertEquals(UpdateOrganizationRequest.builder()
                .name("Acme Corporation")
                .category("MSP client")
                .numberOfEmployees(42)
                .websiteUrl("https://acme.example")
                .notes("VIP")
                .contactInformation(CONTACT_INFORMATION)
                .monthlyRevenue(new BigDecimal("1500.50"))
                .contractStartDate(LocalDate.of(2026, 1, 1))
                .contractEndDate(LocalDate.of(2026, 12, 31))
                .build(), command);
    }

    @Test
    void partialUpdateRequestKeepsUntouchedFieldsNull() {
        UpdateOrganizationRequest command = mapper.toUpdateRequest(
                new UpdateCustomerRequest(null, null, null, null, "new notes", null, null, null, null));

        assertEquals(UpdateOrganizationRequest.builder().notes("new notes").build(), command);
    }

    @ParameterizedTest
    @EnumSource(CustomerStatusAction.class)
    void everyCustomerStatusActionHasItsDomainCounterpart(CustomerStatusAction action) {
        UpdateOrganizationStatusRequest command = mapper.toStatusRequest(new UpdateCustomerStatusRequest(action));

        assertEquals(action.name(), command.status().name());
    }

    private static Organization organization() {
        return Organization.builder()
                .id("64f000000000000000000001")
                .tenantId("tenant-1")
                .organizationId("cust-1")
                .name("Acme Corporation")
                .category("MSP client")
                .numberOfEmployees(42)
                .websiteUrl("https://acme.example")
                .notes("VIP")
                .contactInformation(ContactInformation.builder()
                        .contacts(List.of(ContactPerson.builder().contactName("Jane Doe").title("CTO")
                                .phone("+1 555 0100").email("jane@acme.example").build()))
                        .physicalAddress(Address.builder().street1("1 Main St").city("Springfield").country("US").build())
                        .mailingAddress(Address.builder().street1("PO Box 7").city("Shelbyville").build())
                        .mailingAddressSameAsPhysical(false)
                        .build())
                .monthlyRevenue(new BigDecimal("1500.50"))
                .contractStartDate(LocalDate.of(2026, 1, 1))
                .contractEndDate(LocalDate.of(2026, 12, 31))
                .createdAt(CREATED_AT)
                .updatedAt(UPDATED_AT)
                .isDefault(true)
                .status(OrganizationStatus.ARCHIVED)
                .statusChangedAt(STATUS_CHANGED_AT)
                .build();
    }
}
