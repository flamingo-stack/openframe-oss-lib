package com.openframe.external.controller;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.device.TagFilterOption;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.TagService;
import com.openframe.api.service.device.DeviceFilterService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tag.Tag;
import com.openframe.external.mapper.DeviceMapper;
import com.openframe.external.support.ExternalApiMockMvc;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DeviceControllerTest {

    private static final String BASE = "/api/v1/devices";
    private static final String RAW_CURSOR = "64f000000000000000000001";

    @Mock
    private DeviceService deviceService;
    @Mock
    private DeviceFilterService deviceFilterService;
    @Mock
    private TagService tagService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = ExternalApiMockMvc.standalone(new DeviceController(
                deviceService, deviceFilterService, tagService, new DeviceMapper()));
    }

    @Test
    void listPassesEveryFilterPaginationAndSortParamToTheDomain() throws Exception {
        when(deviceService.queryDevices(any(), any(), any(), any())).thenReturn(page());

        mockMvc.perform(get(BASE)
                        .param("statuses", "ONLINE,OFFLINE")
                        .param("deviceTypes", "LAPTOP")
                        .param("deviceTypes", "SERVER")
                        .param("osTypes", "WINDOWS")
                        .param("customerIds", "cust-1", "cust-2")
                        .param("tagKeys", "site")
                        .param("tagValues", "hq", "branch")
                        .param("search", "reception")
                        .param("limit", "50")
                        .param("cursor", CursorCodec.encode(RAW_CURSOR))
                        .param("sortField", "hostname")
                        .param("sortDirection", "asc"))
                .andExpect(status().isOk());

        ArgumentCaptor<DeviceFilterCriteria> filter = ArgumentCaptor.forClass(DeviceFilterCriteria.class);
        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        ArgumentCaptor<SortInput> sort = ArgumentCaptor.forClass(SortInput.class);
        verify(deviceService).queryDevices(filter.capture(), pagination.capture(), eq("reception"), sort.capture());

        assertEquals(List.of(DeviceStatus.ONLINE, DeviceStatus.OFFLINE), filter.getValue().getStatuses());
        assertEquals(List.of(DeviceType.LAPTOP, DeviceType.SERVER), filter.getValue().getDeviceTypes());
        assertEquals(List.of(OsType.WINDOWS), filter.getValue().getOsTypes());
        assertEquals(List.of("cust-1", "cust-2"), filter.getValue().getOrganizationIds());
        assertEquals(List.of("site"), filter.getValue().getTagKeys());
        assertEquals(List.of("hq", "branch"), filter.getValue().getTagValues());
        assertEquals(50, pagination.getValue().getLimit());
        assertEquals(RAW_CURSOR, pagination.getValue().getCursor());
        assertFalse(pagination.getValue().isBackward());
        assertEquals("hostname", sort.getValue().getField());
        assertEquals(SortDirection.ASC, sort.getValue().getDirection());
    }

    @Test
    void listDefaultsToFirstPageOfTwentyWithoutFilterSearchSortOrTags() throws Exception {
        when(deviceService.queryDevices(any(), any(), any(), any())).thenReturn(page());

        mockMvc.perform(get(BASE)).andExpect(status().isOk());

        ArgumentCaptor<DeviceFilterCriteria> filter = ArgumentCaptor.forClass(DeviceFilterCriteria.class);
        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(deviceService).queryDevices(filter.capture(), pagination.capture(), isNull(), isNull());

        assertEquals(DeviceFilterCriteria.builder().build(), filter.getValue());
        assertEquals(20, pagination.getValue().getLimit());
        assertNull(pagination.getValue().getCursor());
        verifyNoInteractions(tagService);
    }

    @Test
    void listSortsDescendingWhenOnlySortFieldIsGiven() throws Exception {
        when(deviceService.queryDevices(any(), any(), any(), any())).thenReturn(page());

        mockMvc.perform(get(BASE).param("sortField", "lastSeen")).andExpect(status().isOk());

        ArgumentCaptor<SortInput> sort = ArgumentCaptor.forClass(SortInput.class);
        verify(deviceService).queryDevices(any(), any(), isNull(), sort.capture());
        assertEquals("lastSeen", sort.getValue().getField());
        assertEquals(SortDirection.DESC, sort.getValue().getDirection());
    }

    @Test
    void listReturnsDevicesUnderProductNamingWithPageInfoAndCount() throws Exception {
        when(deviceService.queryDevices(any(), any(), any(), any())).thenReturn(page(machine("m-1"), machine("m-2")));

        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.devices.length()").value(2))
                .andExpect(jsonPath("$.devices[0].machineId").value("m-1"))
                .andExpect(jsonPath("$.devices[0].customerId").value("cust-1"))
                .andExpect(jsonPath("$.devices[0].organizationId").doesNotExist())
                .andExpect(jsonPath("$.devices[0].tags").isEmpty())
                .andExpect(jsonPath("$.devices[1].machineId").value("m-2"))
                .andExpect(jsonPath("$.filteredCount").value(2))
                .andExpect(jsonPath("$.pageInfo.hasNextPage").value(true))
                .andExpect(jsonPath("$.pageInfo.endCursor").value("ZW5k"));

        verifyNoInteractions(tagService);
    }

    @Test
    void listWithIncludeTagsLoadsTagsInOneBatchAndZipsThemByPosition() throws Exception {
        when(deviceService.queryDevices(any(), any(), any(), any())).thenReturn(page(machine("m-1"), machine("m-2")));
        when(tagService.getTagsForMachines(List.of("m-1", "m-2")))
                .thenReturn(List.of(List.of(tag("site", "hq")), List.of(tag("env", "prod"), tag("owner", "it"))));

        mockMvc.perform(get(BASE).param("includeTags", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.devices[0].tags.length()").value(1))
                .andExpect(jsonPath("$.devices[0].tags[0].key").value("site"))
                .andExpect(jsonPath("$.devices[0].tags[0].values[0]").value("hq"))
                .andExpect(jsonPath("$.devices[1].tags.length()").value(2))
                .andExpect(jsonPath("$.devices[1].tags[0].key").value("env"))
                .andExpect(jsonPath("$.devices[1].tags[1].key").value("owner"));
    }

    @Test
    void listStillReturnsDevicesWithoutTagsWhenTagLoadingFails() throws Exception {
        when(deviceService.queryDevices(any(), any(), any(), any())).thenReturn(page(machine("m-1")));
        when(tagService.getTagsForMachines(List.of("m-1"))).thenThrow(new IllegalStateException("tags unavailable"));

        mockMvc.perform(get(BASE).param("includeTags", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.devices[0].machineId").value("m-1"))
                .andExpect(jsonPath("$.devices[0].tags").isEmpty());
    }

    @Test
    void malformedCursorIs400AndNeverReachesTheDomain() throws Exception {
        mockMvc.perform(get(BASE).param("cursor", "%%not-base64%%"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Invalid cursor: %%not-base64%%"));

        verifyNoInteractions(deviceService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "101"})
    void limitOutOfRangeIs400AndNeverReachesTheDomain(String limit) throws Exception {
        mockMvc.perform(get(BASE).param("limit", limit))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(deviceService);
    }

    @ParameterizedTest
    @CsvSource({"statuses,BOGUS", "deviceTypes,TOASTER", "osTypes,LINUX", "statuses,online", "limit,many", "includeTags,maybe"})
    void unconvertibleQueryParamIs400TypeMismatch(String param, String value) throws Exception {
        mockMvc.perform(get(BASE).param(param, value))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(deviceService);
    }

    @Test
    void getDeviceReturnsEveryFieldWithItsTags() throws Exception {
        when(deviceService.findByMachineId("m-1")).thenReturn(Optional.of(machine("m-1")));
        when(tagService.getTagsForMachine("m-1")).thenReturn(List.of(tag("site", "hq", "branch")));

        mockMvc.perform(get(BASE + "/m-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("mongo-m-1"))
                .andExpect(jsonPath("$.machineId").value("m-1"))
                .andExpect(jsonPath("$.hostname").value("host-m-1"))
                .andExpect(jsonPath("$.displayName").value("Reception"))
                .andExpect(jsonPath("$.nickname").value("Reception iMac"))
                .andExpect(jsonPath("$.ip").value("192.168.1.100"))
                .andExpect(jsonPath("$.macAddress").value("00:11:22:33:44:55"))
                .andExpect(jsonPath("$.agentVersion").value("1.2.3"))
                .andExpect(jsonPath("$.status").value("ONLINE"))
                .andExpect(jsonPath("$.type").value("LAPTOP"))
                .andExpect(jsonPath("$.osType").value("MAC_OS"))
                .andExpect(jsonPath("$.customerId").value("cust-1"))
                .andExpect(jsonPath("$.organizationId").doesNotExist())
                .andExpect(jsonPath("$.lastSeen").value("2026-03-04T05:06:07.890Z"))
                .andExpect(jsonPath("$.registeredAt").value("2026-01-02T03:04:05.123Z"))
                .andExpect(jsonPath("$.tags.length()").value(1))
                .andExpect(jsonPath("$.tags[0].tagId").value("tag-site"))
                .andExpect(jsonPath("$.tags[0].key").value("site"))
                .andExpect(jsonPath("$.tags[0].values[0]").value("hq"))
                .andExpect(jsonPath("$.tags[0].values[1]").value("branch"));
    }

    @Test
    void unknownDeviceIs404WithDeviceNotFoundCodeAndTagsAreNotLoaded() throws Exception {
        when(deviceService.findByMachineId("missing")).thenReturn(Optional.empty());

        mockMvc.perform(get(BASE + "/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DEVICE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Device not found with ID: missing"));

        verifyNoInteractions(tagService);
    }

    @Test
    void filtersPassEveryParamToTheDomainAndRenameOrganizationsToCustomers() throws Exception {
        when(deviceFilterService.getDeviceFilters(any(DeviceFilterCriteria.class))).thenReturn(CompletableFuture.completedFuture(
                DeviceFilters.builder()
                        .statuses(List.of(new DeviceFilterOption("ONLINE", "Online", 4)))
                        .deviceTypes(List.of(new DeviceFilterOption("LAPTOP", "Laptop", 3)))
                        .osTypes(List.of(new DeviceFilterOption("WINDOWS", "Windows", 2)))
                        .organizationIds(List.of(new DeviceFilterOption("cust-1", "Acme", 5)))
                        .tagKeys(List.of(new TagFilterOption("site", "hq", 1)))
                        .filteredCount(9)
                        .build()));

        mockMvc.perform(get(BASE + "/filters")
                        .param("statuses", "ONLINE")
                        .param("deviceTypes", "LAPTOP")
                        .param("osTypes", "WINDOWS", "MAC_OS")
                        .param("customerIds", "cust-1")
                        .param("tagKeys", "site")
                        .param("tagValues", "hq"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statuses[0].value").value("ONLINE"))
                .andExpect(jsonPath("$.statuses[0].label").value("Online"))
                .andExpect(jsonPath("$.statuses[0].count").value(4))
                .andExpect(jsonPath("$.deviceTypes[0].value").value("LAPTOP"))
                .andExpect(jsonPath("$.osTypes[0].value").value("WINDOWS"))
                .andExpect(jsonPath("$.customerIds[0].value").value("cust-1"))
                .andExpect(jsonPath("$.customerIds[0].label").value("Acme"))
                .andExpect(jsonPath("$.customerIds[0].count").value(5))
                .andExpect(jsonPath("$.organizationIds").doesNotExist())
                .andExpect(jsonPath("$.tagKeys[0].key").value("site"))
                .andExpect(jsonPath("$.tagKeys[0].value").value("hq"))
                .andExpect(jsonPath("$.tagKeys[0].count").value(1))
                .andExpect(jsonPath("$.filteredCount").value(9));

        ArgumentCaptor<DeviceFilterCriteria> filter = ArgumentCaptor.forClass(DeviceFilterCriteria.class);
        verify(deviceFilterService).getDeviceFilters(filter.capture());
        assertEquals(DeviceFilterCriteria.builder()
                .statuses(List.of(DeviceStatus.ONLINE))
                .deviceTypes(List.of(DeviceType.LAPTOP))
                .osTypes(List.of(OsType.WINDOWS, OsType.MAC_OS))
                .organizationIds(List.of("cust-1"))
                .tagKeys(List.of("site"))
                .tagValues(List.of("hq"))
                .build(), filter.getValue());
        verifyNoInteractions(deviceService);
    }

    @Test
    void filtersWithUnknownStatusAre400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE + "/filters").param("statuses", "BOGUS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(deviceFilterService);
    }

    @ParameterizedTest
    @ValueSource(strings = {"ARCHIVED", "DELETED"})
    void updateStatusIs204AndPassesMachineIdAndStatusToTheDomain(String status) throws Exception {
        mockMvc.perform(json(patch(BASE + "/m-1"), Map.of("status", status)))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(deviceService).updateStatusByMachineId("m-1", DeviceStatus.valueOf(status));
    }

    @Test
    void updateStatusOfUnknownDeviceIs404WithDeviceNotFoundCode() throws Exception {
        doThrow(new DeviceNotFoundException("Device not found: missing"))
                .when(deviceService).updateStatusByMachineId("missing", DeviceStatus.ARCHIVED);

        mockMvc.perform(json(patch(BASE + "/missing"), Map.of("status", "ARCHIVED")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DEVICE_NOT_FOUND"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"status\":\"BOGUS\"}", "{\"status\":\"archived\"}", "{not json"})
    void updateStatusWithUnreadableBodyIs400AndNothingIsUpdated(String body) throws Exception {
        mockMvc.perform(patch(BASE + "/m-1").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Malformed request body"));

        verifyNoInteractions(deviceService);
    }

    @Test
    void updateNicknameIs204AndPassesMachineIdAndNicknameToTheDomain() throws Exception {
        mockMvc.perform(json(patch(BASE + "/m-1/nickname"), Map.of("nickname", "Reception iMac")))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(deviceService).updateNickname("m-1", "Reception iMac");
    }

    @Test
    void updateNicknameWithoutNicknameClearsIt() throws Exception {
        mockMvc.perform(patch(BASE + "/m-1/nickname").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNoContent());

        verify(deviceService).updateNickname("m-1", null);
    }

    @Test
    void updateNicknameOfUnknownDeviceIs404WithDeviceNotFoundCode() throws Exception {
        when(deviceService.updateNickname("missing", "Front desk"))
                .thenThrow(new DeviceNotFoundException("Device not found: missing"));

        mockMvc.perform(json(patch(BASE + "/missing/nickname"), Map.of("nickname", "Front desk")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DEVICE_NOT_FOUND"));
    }

    private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON)
                .content(ExternalApiMockMvc.objectMapper().writeValueAsString(body));
    }

    private static CountedGenericQueryResult<Machine> page(Machine... machines) {
        return CountedGenericQueryResult.<Machine>builder()
                .items(List.of(machines))
                .pageInfo(PageInfo.builder().hasNextPage(true).endCursor("ZW5k").build())
                .filteredCount(machines.length)
                .build();
    }

    private static Machine machine(String machineId) {
        Machine machine = new Machine();
        machine.setId("mongo-" + machineId);
        machine.setMachineId(machineId);
        machine.setHostname("host-" + machineId);
        machine.setDisplayName("Reception");
        machine.setNickname("Reception iMac");
        machine.setIp("192.168.1.100");
        machine.setMacAddress("00:11:22:33:44:55");
        machine.setAgentVersion("1.2.3");
        machine.setStatus(DeviceStatus.ONLINE);
        machine.setType(DeviceType.LAPTOP);
        machine.setOsType(OsType.MAC_OS);
        machine.setOrganizationId("cust-1");
        machine.setLastSeen(Instant.parse("2026-03-04T05:06:07.890123Z"));
        machine.setRegisteredAt(Instant.parse("2026-01-02T03:04:05.123456789Z"));
        return machine;
    }

    private static Tag tag(String key, String... values) {
        return Tag.builder().id("tag-" + key).key(key).values(List.of(values)).build();
    }
}
