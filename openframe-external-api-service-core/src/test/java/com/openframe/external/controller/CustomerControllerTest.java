package com.openframe.external.controller;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.organization.CreateOrganizationRequest;
import com.openframe.api.dto.organization.OrganizationFilterOptions;
import com.openframe.api.dto.organization.UpdateOrganizationRequest;
import com.openframe.api.dto.organization.UpdateOrganizationStatusRequest;
import com.openframe.api.dto.organization.UpdateOrganizationStatusRequest.OrganizationStatusAction;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.OrganizationMapper;
import com.openframe.api.service.organization.OrganizationCommandService;
import com.openframe.api.service.organization.OrganizationQueryService;
import com.openframe.data.document.organization.Address;
import com.openframe.data.document.organization.ContactInformation;
import com.openframe.data.document.organization.ContactPerson;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.exception.OrganizationHasMachinesException;
import com.openframe.data.service.OrganizationService;
import com.openframe.external.mapper.CustomerMapper;
import com.openframe.external.support.ExternalApiMockMvc;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CustomerControllerTest {

    private static final String BASE = "/api/v1/customers";
    private static final String CUSTOMER_ID = "0b0f9f3a-9c1d-4a5e-9d55-8c9a2f6f1e42";
    private static final String MONGO_ID = "64f000000000000000000001";

    @Mock
    private OrganizationService organizationService;
    @Mock
    private OrganizationQueryService organizationQueryService;
    @Mock
    private OrganizationCommandService organizationCommandService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = ExternalApiMockMvc.standalone(new CustomerController(
                organizationService, organizationQueryService, organizationCommandService,
                new CustomerMapper(new OrganizationMapper())));
    }

    @Test
    void listPassesEveryFilterPaginationAndSortParamToTheDomain() throws Exception {
        when(organizationQueryService.queryOrganizations(any(), any(), any(), any())).thenReturn(page());

        mockMvc.perform(get(BASE)
                        .param("category", "MSP client")
                        .param("minEmployees", "5")
                        .param("maxEmployees", "500")
                        .param("hasActiveContract", "true")
                        .param("status", "ARCHIVED")
                        .param("lastActivityFrom", "2026-01-01T00:00:00Z")
                        .param("lastActivityTo", "2026-02-01T00:00:00Z")
                        .param("search", "acme")
                        .param("limit", "50")
                        .param("cursor", CursorCodec.encode(MONGO_ID))
                        .param("sortField", "name")
                        .param("sortDirection", "asc"))
                .andExpect(status().isOk());

        ArgumentCaptor<OrganizationFilterOptions> filter = ArgumentCaptor.forClass(OrganizationFilterOptions.class);
        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        ArgumentCaptor<SortInput> sort = ArgumentCaptor.forClass(SortInput.class);
        verify(organizationQueryService).queryOrganizations(filter.capture(), pagination.capture(), eq("acme"), sort.capture());

        assertEquals("MSP client", filter.getValue().getCategory());
        assertEquals(5, filter.getValue().getMinEmployees());
        assertEquals(500, filter.getValue().getMaxEmployees());
        assertEquals(Boolean.TRUE, filter.getValue().getHasActiveContract());
        assertEquals("ARCHIVED", filter.getValue().getStatus());
        assertEquals(Instant.parse("2026-01-01T00:00:00Z"), filter.getValue().getLastActivityFrom());
        assertEquals(Instant.parse("2026-02-01T00:00:00Z"), filter.getValue().getLastActivityTo());
        assertEquals(50, pagination.getValue().getLimit());
        assertEquals(MONGO_ID, pagination.getValue().getCursor());
        assertFalse(pagination.getValue().isBackward());
        assertEquals("name", sort.getValue().getField());
        assertEquals(SortDirection.ASC, sort.getValue().getDirection());
    }

    @Test
    void listDefaultsToFirstPageOfTwentyWithoutFilterSearchOrSort() throws Exception {
        when(organizationQueryService.queryOrganizations(any(), any(), any(), any())).thenReturn(page());

        mockMvc.perform(get(BASE)).andExpect(status().isOk());

        ArgumentCaptor<OrganizationFilterOptions> filter = ArgumentCaptor.forClass(OrganizationFilterOptions.class);
        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(organizationQueryService).queryOrganizations(filter.capture(), pagination.capture(), isNull(), isNull());

        assertEquals(OrganizationFilterOptions.builder().build(), filter.getValue());
        assertEquals(20, pagination.getValue().getLimit());
        assertNull(pagination.getValue().getCursor());
    }

    @Test
    void listSortsDescendingWhenOnlySortFieldIsGiven() throws Exception {
        when(organizationQueryService.queryOrganizations(any(), any(), any(), any())).thenReturn(page());

        mockMvc.perform(get(BASE).param("sortField", "createdAt")).andExpect(status().isOk());

        ArgumentCaptor<SortInput> sort = ArgumentCaptor.forClass(SortInput.class);
        verify(organizationQueryService).queryOrganizations(any(), any(), isNull(), sort.capture());
        assertEquals("createdAt", sort.getValue().getField());
        assertEquals(SortDirection.DESC, sort.getValue().getDirection());
    }

    @Test
    void listTreatsBlankCursorAsFirstPage() throws Exception {
        when(organizationQueryService.queryOrganizations(any(), any(), any(), any())).thenReturn(page());

        mockMvc.perform(get(BASE).param("cursor", "  ")).andExpect(status().isOk());

        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(organizationQueryService).queryOrganizations(any(), pagination.capture(), isNull(), isNull());
        assertNull(pagination.getValue().getCursor());
    }

    @Test
    void listReturnsCustomersUnderProductNamingWithPageInfoAndCount() throws Exception {
        when(organizationQueryService.queryOrganizations(any(), any(), any(), any())).thenReturn(
                CountedGenericQueryResult.<Organization>builder()
                        .items(List.of(organization(), Organization.builder().id("mongo-2").organizationId("cust-2").name("Globex").build()))
                        .pageInfo(PageInfo.builder().hasNextPage(true).hasPreviousPage(false)
                                .startCursor("c3RhcnQ=").endCursor("ZW5k").build())
                        .filteredCount(7)
                        .build());

        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customers.length()").value(2))
                .andExpect(jsonPath("$.customers[0].id").value(CUSTOMER_ID))
                .andExpect(jsonPath("$.customers[0].name").value("Acme Corporation"))
                .andExpect(jsonPath("$.customers[0].organizationId").doesNotExist())
                .andExpect(jsonPath("$.customers[1].id").value("cust-2"))
                .andExpect(jsonPath("$.organizations").doesNotExist())
                .andExpect(jsonPath("$.filteredCount").value(7))
                .andExpect(jsonPath("$.pageInfo.hasNextPage").value(true))
                .andExpect(jsonPath("$.pageInfo.hasPreviousPage").value(false))
                .andExpect(jsonPath("$.pageInfo.startCursor").value("c3RhcnQ="))
                .andExpect(jsonPath("$.pageInfo.endCursor").value("ZW5k"));
    }

    @Test
    void malformedCursorIs400AndNeverReachesTheDomain() throws Exception {
        mockMvc.perform(get(BASE).param("cursor", "%%not-base64%%"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Invalid cursor: %%not-base64%%"));

        verifyNoInteractions(organizationQueryService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "101"})
    void limitOutOfRangeIs400AndNeverReachesTheDomain(String limit) throws Exception {
        mockMvc.perform(get(BASE).param("limit", limit))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(organizationQueryService);
    }

    @Test
    void limitBoundsAreInclusive() throws Exception {
        when(organizationQueryService.queryOrganizations(any(), any(), any(), any())).thenReturn(page());

        mockMvc.perform(get(BASE).param("limit", "1")).andExpect(status().isOk());
        mockMvc.perform(get(BASE).param("limit", "100")).andExpect(status().isOk());
    }

    @Test
    void nonNumericLimitIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE).param("limit", "many"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"))
                .andExpect(jsonPath("$.message").value("Invalid value 'many' for parameter 'limit'"));

        verifyNoInteractions(organizationQueryService);
    }

    @Test
    void unparseableLastActivityBoundIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE).param("lastActivityFrom", "yesterday"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(organizationQueryService);
    }

    @Test
    void getCustomerReturnsTheBusinessIdAsIdAndMillisecondTimestamps() throws Exception {
        when(organizationService.getOrganizationByOrganizationId(CUSTOMER_ID)).thenReturn(Optional.of(organization()));

        mockMvc.perform(get(BASE + "/" + CUSTOMER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(CUSTOMER_ID))
                .andExpect(jsonPath("$.organizationId").doesNotExist())
                .andExpect(jsonPath("$.name").value("Acme Corporation"))
                .andExpect(jsonPath("$.category").value("MSP client"))
                .andExpect(jsonPath("$.numberOfEmployees").value(42))
                .andExpect(jsonPath("$.websiteUrl").value("https://acme.example"))
                .andExpect(jsonPath("$.notes").value("VIP"))
                .andExpect(jsonPath("$.monthlyRevenue").value(1500.50))
                .andExpect(jsonPath("$.createdAt").value("2026-01-02T03:04:05.123Z"))
                .andExpect(jsonPath("$.updatedAt").value("2026-03-04T05:06:07.890Z"))
                .andExpect(jsonPath("$.lastActivityAt").value("2026-03-04T05:06:07.890Z"))
                .andExpect(jsonPath("$.isDefault").value(false))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.contactInformation.contacts[0].contactName").value("Jane Doe"))
                .andExpect(jsonPath("$.contactInformation.contacts[0].email").value("jane@acme.example"))
                .andExpect(jsonPath("$.contactInformation.physicalAddress.city").value("Springfield"))
                .andExpect(jsonPath("$.contactInformation.mailingAddressSameAsPhysical").value(true));
    }

    @Test
    void unknownCustomerIs404WithCustomerNotFoundCode() throws Exception {
        when(organizationService.getOrganizationByOrganizationId("missing")).thenReturn(Optional.empty());

        mockMvc.perform(get(BASE + "/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Customer not found: missing"));
    }

    @Test
    void createCustomerIs201AndHandsTheWholeRequestToTheDomain() throws Exception {
        when(organizationCommandService.createOrganization(any())).thenReturn(organization());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", "Acme Corporation");
        body.put("category", "MSP client");
        body.put("numberOfEmployees", 42);
        body.put("websiteUrl", "https://acme.example");
        body.put("notes", "VIP");
        body.put("contactInformation", Map.of(
                "contacts", List.of(Map.of("contactName", "Jane Doe", "email", "jane@acme.example")),
                "physicalAddress", Map.of("city", "Springfield"),
                "mailingAddressSameAsPhysical", true));
        body.put("monthlyRevenue", new BigDecimal("1500.50"));
        body.put("contractStartDate", "2026-01-01");
        body.put("contractEndDate", "2026-12-31");

        mockMvc.perform(json(post(BASE), body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(CUSTOMER_ID))
                .andExpect(jsonPath("$.organizationId").doesNotExist())
                .andExpect(jsonPath("$.name").value("Acme Corporation"));

        ArgumentCaptor<CreateOrganizationRequest> command = ArgumentCaptor.forClass(CreateOrganizationRequest.class);
        verify(organizationCommandService).createOrganization(command.capture());
        assertEquals("Acme Corporation", command.getValue().name());
        assertEquals("MSP client", command.getValue().category());
        assertEquals(42, command.getValue().numberOfEmployees());
        assertEquals("https://acme.example", command.getValue().websiteUrl());
        assertEquals("VIP", command.getValue().notes());
        assertEquals("Jane Doe", command.getValue().contactInformation().contacts().getFirst().contactName());
        assertEquals("Springfield", command.getValue().contactInformation().physicalAddress().city());
        assertEquals(Boolean.TRUE, command.getValue().contactInformation().mailingAddressSameAsPhysical());
        assertEquals(new BigDecimal("1500.50"), command.getValue().monthlyRevenue());
        assertEquals(LocalDate.of(2026, 1, 1), command.getValue().contractStartDate());
        assertEquals(LocalDate.of(2026, 12, 31), command.getValue().contractEndDate());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"name\":null}", "{\"name\":\"\"}", "{\"name\":\"   \"}"})
    void createCustomerWithoutNameIs400AndNothingIsCreated(String body) throws Exception {
        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("name"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Name is required"));

        verifyNoInteractions(organizationCommandService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"numberOfEmployees", "monthlyRevenue"})
    void createCustomerWithNegativeNumberIs400AndNothingIsCreated(String field) throws Exception {
        mockMvc.perform(json(post(BASE), Map.of("name", "Acme", field, -1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value(field));

        verifyNoInteractions(organizationCommandService);
    }

    @Test
    void createCustomerAcceptsZeroEmployeesAndZeroRevenue() throws Exception {
        when(organizationCommandService.createOrganization(any())).thenReturn(organization());

        mockMvc.perform(json(post(BASE), Map.of("name", "Acme", "numberOfEmployees", 0, "monthlyRevenue", 0)))
                .andExpect(status().isCreated());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{not json", "{\"name\":\"Acme\",\"contractStartDate\":\"01/02/2026\"}", "{\"name\":\"Acme\",\"numberOfEmployees\":\"many\"}"})
    void createCustomerWithUnreadableBodyIs400AndNothingIsCreated(String body) throws Exception {
        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Malformed request body"));

        verifyNoInteractions(organizationCommandService);
    }

    @Test
    void updateCustomerAppliesOnlyTheGivenFields() throws Exception {
        when(organizationCommandService.updateOrganization(eq(CUSTOMER_ID), any())).thenReturn(organization());

        mockMvc.perform(json(put(BASE + "/" + CUSTOMER_ID), Map.of("name", "Acme Corporation", "numberOfEmployees", 42)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(CUSTOMER_ID))
                .andExpect(jsonPath("$.organizationId").doesNotExist())
                .andExpect(jsonPath("$.numberOfEmployees").value(42));

        ArgumentCaptor<UpdateOrganizationRequest> command = ArgumentCaptor.forClass(UpdateOrganizationRequest.class);
        verify(organizationCommandService).updateOrganization(eq(CUSTOMER_ID), command.capture());
        assertEquals(UpdateOrganizationRequest.builder().name("Acme Corporation").numberOfEmployees(42).build(),
                command.getValue());
    }

    @Test
    void updateUnknownCustomerIs404WithCustomerNotFoundCode() throws Exception {
        when(organizationCommandService.updateOrganization(eq("missing"), any()))
                .thenThrow(new IllegalArgumentException("Organization not found with id: missing"));

        mockMvc.perform(json(put(BASE + "/missing"), Map.of("name", "Acme")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Customer not found: missing"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"numberOfEmployees", "monthlyRevenue"})
    void updateCustomerWithNegativeNumberIs400AndNothingIsUpdated(String field) throws Exception {
        mockMvc.perform(json(put(BASE + "/" + CUSTOMER_ID), Map.of(field, -5)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value(field));

        verifyNoInteractions(organizationCommandService);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void canArchiveReturnsTheDomainAnswerAsBareBoolean(boolean canArchive) throws Exception {
        when(organizationService.getOrganizationByOrganizationId(CUSTOMER_ID)).thenReturn(Optional.of(organization()));
        when(organizationService.canArchiveOrganization(CUSTOMER_ID)).thenReturn(canArchive);

        mockMvc.perform(get(BASE + "/" + CUSTOMER_ID + "/can-archive"))
                .andExpect(status().isOk())
                .andExpect(content().string(String.valueOf(canArchive)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"ARCHIVED", "ACTIVE"})
    void updateStatusIs204AndMapsTheActionOntoTheDomainAction(String action) throws Exception {
        when(organizationService.getOrganizationByOrganizationId(CUSTOMER_ID)).thenReturn(Optional.of(organization()));

        mockMvc.perform(json(patch(BASE + "/" + CUSTOMER_ID + "/status"), Map.of("status", action)))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(organizationCommandService).updateOrganizationStatus(CUSTOMER_ID,
                new UpdateOrganizationStatusRequest(OrganizationStatusAction.valueOf(action)));
    }

    @Test
    void canArchiveOfUnknownCustomerIs404WithCustomerNotFoundCode() throws Exception {
        when(organizationService.getOrganizationByOrganizationId("missing")).thenReturn(Optional.empty());

        mockMvc.perform(get(BASE + "/missing/can-archive"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_FOUND"));

        verify(organizationService, never()).canArchiveOrganization(any());
    }

    @Test
    void updateStatusOfUnknownCustomerIs404AndNothingIsUpdated() throws Exception {
        when(organizationService.getOrganizationByOrganizationId("missing")).thenReturn(Optional.empty());

        mockMvc.perform(json(patch(BASE + "/missing/status"), Map.of("status", "ARCHIVED")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CUSTOMER_NOT_FOUND"));

        verifyNoInteractions(organizationCommandService);
    }

    @Test
    void archivingCustomerWithActiveDevicesIs409() throws Exception {
        when(organizationService.getOrganizationByOrganizationId(CUSTOMER_ID)).thenReturn(Optional.of(organization()));
        doThrow(new OrganizationHasMachinesException(CUSTOMER_ID))
                .when(organizationCommandService).updateOrganizationStatus(eq(CUSTOMER_ID), any());

        mockMvc.perform(json(patch(BASE + "/" + CUSTOMER_ID + "/status"), Map.of("status", "ARCHIVED")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_HAS_MACHINES"));
    }

    @Test
    void statusChangeRefusedByTheDomainIs400() throws Exception {
        when(organizationService.getOrganizationByOrganizationId(CUSTOMER_ID)).thenReturn(Optional.of(organization()));
        doThrow(new IllegalArgumentException("Only archived organizations can be set to ACTIVE"))
                .when(organizationCommandService).updateOrganizationStatus(eq(CUSTOMER_ID), any());

        mockMvc.perform(json(patch(BASE + "/" + CUSTOMER_ID + "/status"), Map.of("status", "ACTIVE")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"status\":null}"})
    void updateStatusWithoutStatusIs400AndNothingIsUpdated(String body) throws Exception {
        mockMvc.perform(patch(BASE + "/" + CUSTOMER_ID + "/status").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("status"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Status is required"));

        verifyNoInteractions(organizationCommandService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"DELETED", "archived", "BOGUS"})
    void updateStatusWithUnknownActionIs400AndNothingIsUpdated(String action) throws Exception {
        mockMvc.perform(json(patch(BASE + "/" + CUSTOMER_ID + "/status"), Map.of("status", action)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        verifyNoInteractions(organizationCommandService);
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON)
                .content(ExternalApiMockMvc.objectMapper().writeValueAsString(body));
    }

    private static CountedGenericQueryResult<Organization> page() {
        return CountedGenericQueryResult.<Organization>builder()
                .items(List.of())
                .pageInfo(PageInfo.builder().build())
                .filteredCount(0)
                .build();
    }

    private static Organization organization() {
        return Organization.builder()
                .id(MONGO_ID)
                .organizationId(CUSTOMER_ID)
                .name("Acme Corporation")
                .category("MSP client")
                .numberOfEmployees(42)
                .websiteUrl("https://acme.example")
                .notes("VIP")
                .contactInformation(ContactInformation.builder()
                        .contacts(List.of(ContactPerson.builder().contactName("Jane Doe").email("jane@acme.example").build()))
                        .physicalAddress(Address.builder().city("Springfield").build())
                        .mailingAddressSameAsPhysical(true)
                        .build())
                .monthlyRevenue(new BigDecimal("1500.50"))
                .contractStartDate(LocalDate.of(2026, 1, 1))
                .contractEndDate(LocalDate.of(2026, 12, 31))
                .createdAt(Instant.parse("2026-01-02T03:04:05.123456789Z"))
                .updatedAt(Instant.parse("2026-03-04T05:06:07.890123Z"))
                .status(OrganizationStatus.ACTIVE)
                .build();
    }
}
