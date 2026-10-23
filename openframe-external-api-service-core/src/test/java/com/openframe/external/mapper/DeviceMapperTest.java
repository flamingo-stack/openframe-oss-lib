package com.openframe.external.mapper;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.device.DeviceFilters;
import com.openframe.api.dto.device.TagFilterOption;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tag.Tag;
import com.openframe.external.dto.device.DeviceFilterItem;
import com.openframe.external.dto.device.DeviceFilterResponse;
import com.openframe.external.dto.device.DeviceResponse;
import com.openframe.external.dto.device.DeviceTagResponse;
import com.openframe.external.dto.device.DevicesResponse;
import com.openframe.external.dto.device.TagFilterItem;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeviceMapperTest {

    private static final Instant LAST_SEEN = Instant.parse("2026-03-04T05:06:07Z");
    private static final Instant REGISTERED_AT = Instant.parse("2026-01-02T03:04:05Z");
    private static final Instant UPDATED_AT = Instant.parse("2026-02-03T04:05:06Z");
    private static final Instant TAG_CREATED_AT = Instant.parse("2025-12-01T00:00:00Z");

    private final DeviceMapper mapper = new DeviceMapper();

    @Test
    void deviceResponseCarriesEveryMachineField() {
        DeviceResponse response = mapper.toDeviceResponse(machine("m-1"), List.of());

        assertEquals("mongo-m-1", response.getId());
        assertEquals("m-1", response.getMachineId());
        assertEquals("host-m-1", response.getHostname());
        assertEquals("Reception", response.getDisplayName());
        assertEquals("Reception iMac", response.getNickname());
        assertEquals("192.168.1.100", response.getIp());
        assertEquals("00:11:22:33:44:55", response.getMacAddress());
        assertEquals("os-uuid-1", response.getOsUuid());
        assertEquals("1.2.3", response.getAgentVersion());
        assertEquals(DeviceStatus.ONLINE, response.getStatus());
        assertEquals(LAST_SEEN, response.getLastSeen());
        assertEquals("SN-1", response.getSerialNumber());
        assertEquals("Apple", response.getManufacturer());
        assertEquals("iMac", response.getModel());
        assertEquals(DeviceType.DESKTOP, response.getType());
        assertEquals("15.1", response.getOsVersion());
        assertEquals("24B83", response.getOsBuild());
        assertEquals("Europe/Kyiv", response.getTimezone());
        assertEquals(REGISTERED_AT, response.getRegisteredAt());
        assertEquals(UPDATED_AT, response.getUpdatedAt());
    }

    @Test
    void machineOrganizationIdIsExposedAsCustomerId() {
        assertEquals("cust-1", mapper.toDeviceResponse(machine("m-1"), List.of()).getCustomerId());
    }

    @ParameterizedTest
    @EnumSource(OsType.class)
    void osTypeIsExposedByItsEnumName(OsType osType) {
        Machine machine = machine("m-1");
        machine.setOsType(osType);

        assertEquals(osType.name(), mapper.toDeviceResponse(machine, List.of()).getOsType());
    }

    @Test
    void missingOsTypeStaysNull() {
        Machine machine = machine("m-1");
        machine.setOsType(null);

        assertNull(mapper.toDeviceResponse(machine, List.of()).getOsType());
    }

    @Test
    void emptyMachineMapsToResponseOfNullsWithEmptyTags() {
        DeviceResponse response = mapper.toDeviceResponse(new Machine(), null);

        assertEquals(DeviceResponse.builder().tags(List.of()).build(), response);
    }

    @Test
    void deviceTagsAreMappedInOrder() {
        DeviceResponse response = mapper.toDeviceResponse(machine("m-1"), List.of(tag("site", "hq"), tag("env", "prod")));

        assertEquals(List.of("site", "env"), response.getTags().stream().map(DeviceTagResponse::getKey).toList());
    }

    @Test
    void tagResponseCarriesTheTagDefinitionAndValues() {
        Tag tag = Tag.builder().id("tag-1").key("site").description("Physical location").color("#FF5733")
                .values(List.of("hq", "branch")).createdAt(TAG_CREATED_AT).createdBy("user-7").build();

        DeviceTagResponse response = mapper.toDeviceTagResponse(tag);

        assertEquals("tag-1", response.getTagId());
        assertEquals("site", response.getKey());
        assertEquals("Physical location", response.getDescription());
        assertEquals("#FF5733", response.getColor());
        assertEquals(List.of("hq", "branch"), response.getValues());
        assertEquals(TAG_CREATED_AT, response.getCreatedAt());
        assertEquals("user-7", response.getCreatedBy());
    }

    @Test
    void tagWithoutValuesGetsAnEmptyValueList() {
        DeviceTagResponse response = mapper.toDeviceTagResponse(Tag.builder().id("tag-1").key("site").build());

        assertTrue(response.getValues().isEmpty());
    }

    @Test
    void devicesResponseWithoutTagsKeepsOrderCountAndPageInfo() {
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).endCursor("end").build();

        DevicesResponse response = mapper.toDevicesResponse(result(pageInfo, 17, machine("m-1"), machine("m-2")));

        assertEquals(List.of("m-1", "m-2"), response.getDevices().stream().map(DeviceResponse::getMachineId).toList());
        assertTrue(response.getDevices().stream().allMatch(device -> device.getTags().isEmpty()));
        assertEquals(17, response.getFilteredCount());
        assertSame(pageInfo, response.getPageInfo());
    }

    @Test
    void devicesResponseOfEmptyPageHasNoDevices() {
        DevicesResponse response = mapper.toDevicesResponse(result(null, 0));

        assertTrue(response.getDevices().isEmpty());
        assertEquals(0, response.getFilteredCount());
        assertNull(response.getPageInfo());
    }

    @Test
    void devicesResponseWithTagsZipsTagListsByPosition() {
        PageInfo pageInfo = PageInfo.builder().hasPreviousPage(true).startCursor("start").build();

        DevicesResponse response = mapper.toDevicesResponseWithDeviceTags(
                result(pageInfo, 2, machine("m-1"), machine("m-2")),
                List.of(List.of(tag("site", "hq")), List.of(tag("env", "prod"), tag("owner", "it"))));

        assertEquals(List.of("site"), tagKeys(response.getDevices().get(0)));
        assertEquals(List.of("env", "owner"), tagKeys(response.getDevices().get(1)));
        assertEquals(2, response.getFilteredCount());
        assertSame(pageInfo, response.getPageInfo());
    }

    @Test
    void devicesBeyondTheTagListsGetEmptyTags() {
        DevicesResponse response = mapper.toDevicesResponseWithDeviceTags(
                result(null, 3, machine("m-1"), machine("m-2"), machine("m-3")),
                List.of(List.of(tag("site", "hq"))));

        assertEquals(List.of("site"), tagKeys(response.getDevices().get(0)));
        assertTrue(response.getDevices().get(1).getTags().isEmpty());
        assertTrue(response.getDevices().get(2).getTags().isEmpty());
    }

    @Test
    void filterResponseRenamesOrganizationsToCustomersAndKeepsCounts() {
        DeviceFilterResponse response = mapper.toDeviceFilterResponse(DeviceFilters.builder()
                .statuses(List.of(new DeviceFilterOption("ONLINE", "Online", 4), new DeviceFilterOption("OFFLINE", "Offline", 1)))
                .deviceTypes(List.of(new DeviceFilterOption("LAPTOP", "Laptop", 3)))
                .osTypes(List.of(new DeviceFilterOption("WINDOWS", "Windows", 2)))
                .organizationIds(List.of(new DeviceFilterOption("cust-1", "Acme", 5)))
                .tagKeys(List.of(new TagFilterOption("site", "hq", 1)))
                .filteredCount(5)
                .build());

        assertEquals(List.of(new DeviceFilterItem("ONLINE", "Online", 4), new DeviceFilterItem("OFFLINE", "Offline", 1)),
                response.getStatuses());
        assertEquals(List.of(new DeviceFilterItem("LAPTOP", "Laptop", 3)), response.getDeviceTypes());
        assertEquals(List.of(new DeviceFilterItem("WINDOWS", "Windows", 2)), response.getOsTypes());
        assertEquals(List.of(new DeviceFilterItem("cust-1", "Acme", 5)), response.getCustomerIds());
        assertEquals(List.of(new TagFilterItem("site", "hq", 1)), response.getTagKeys());
        assertEquals(5, response.getFilteredCount());
    }

    @Test
    void missingFilterFacetsBecomeEmptyLists() {
        DeviceFilterResponse response = mapper.toDeviceFilterResponse(new DeviceFilters());

        assertTrue(response.getStatuses().isEmpty());
        assertTrue(response.getDeviceTypes().isEmpty());
        assertTrue(response.getOsTypes().isEmpty());
        assertTrue(response.getCustomerIds().isEmpty());
        assertTrue(response.getTagKeys().isEmpty());
        assertNull(response.getFilteredCount());
    }

    private static List<String> tagKeys(DeviceResponse device) {
        return device.getTags().stream().map(DeviceTagResponse::getKey).toList();
    }

    private static CountedGenericQueryResult<Machine> result(PageInfo pageInfo, int filteredCount, Machine... machines) {
        return CountedGenericQueryResult.<Machine>builder()
                .items(List.of(machines))
                .pageInfo(pageInfo)
                .filteredCount(filteredCount)
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
        machine.setOsUuid("os-uuid-1");
        machine.setAgentVersion("1.2.3");
        machine.setStatus(DeviceStatus.ONLINE);
        machine.setLastSeen(LAST_SEEN);
        machine.setOrganizationId("cust-1");
        machine.setSerialNumber("SN-1");
        machine.setManufacturer("Apple");
        machine.setModel("iMac");
        machine.setType(DeviceType.DESKTOP);
        machine.setOsType(OsType.MAC_OS);
        machine.setOsVersion("15.1");
        machine.setOsBuild("24B83");
        machine.setTimezone("Europe/Kyiv");
        machine.setRegisteredAt(REGISTERED_AT);
        machine.setUpdatedAt(UPDATED_AT);
        return machine;
    }

    private static Tag tag(String key, String... values) {
        return Tag.builder().id("tag-" + key).key(key).values(List.of(values)).build();
    }
}
