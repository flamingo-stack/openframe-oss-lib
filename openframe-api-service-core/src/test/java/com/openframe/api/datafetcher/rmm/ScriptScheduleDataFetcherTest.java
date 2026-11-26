package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.AvailableDeviceEdge;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.device.DeviceFilterCriteria;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.mapper.GraphQLScriptScheduleMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptDeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptFilterService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptDispatchService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.repository.cursor.KeysetCursor;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptScheduleDataFetcherTest {

    private static final String SCHEDULE_ID = "schedule-1";
    private static final String ASSIGNED_MACHINE_ID = "m1";
    private static final String OTHER_MACHINE_ID = "m2";
    private static final String ASSIGNED_ROW = "65f1a2b3c4d5e6f708192a01";
    private static final String OTHER_ROW = "65f1a2b3c4d5e6f708192a02";
    private static final String CURSOR_ROW = "65f1a2b3c4d5e6f708192a3b";
    private static final String SEARCH = "mac";
    private static final int FIRST = 20;
    private static final int LAST = 5;
    private static final List<String> ASSIGNED_MACHINE_IDS = List.of(ASSIGNED_MACHINE_ID);
    private static final List<OsType> PLATFORMS = List.of(OsType.WINDOWS);
    private static final SortInput BY_HOSTNAME = SortInput.builder()
            .field("hostname").direction(SortDirection.DESC).build();

    @Mock private ScheduleScriptService scheduleService;
    @Mock private ScheduleScriptFilterService scheduleFilterService;
    @Mock private ScriptService scriptService;
    @Mock private ScheduleScriptDeviceService scheduleDeviceService;
    @Mock private ScriptDispatchService scriptDispatchService;
    @Mock private GraphQLScriptScheduleMapper scheduleMapper;
    @Mock private DeviceService deviceService;
    @Mock private DgsDataFetchingEnvironment dfe;
    @Spy private GraphQLDeviceMapper deviceMapper = new GraphQLDeviceMapper();
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private ScriptScheduleDataFetcher dataFetcher;

    private ScriptScheduleResponse schedule;
    private DeviceFilterCriteria noFilter;

    @BeforeEach
    void setUp() {
        schedule = ScriptScheduleResponse.builder().id(SCHEDULE_ID).supportedPlatforms(PLATFORMS).build();
        noFilter = deviceMapper.toDeviceFilterCriteria(null);
    }

    @Test
    void assignedDevices_lastAndBefore_theAssignedDeviceQueryGetsTheBackwardPage() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString("hostname", Sort.Direction.DESC, "host-c", CURSOR_ROW);
        String before = cursor.encode();
        ConnectionArgs lastBefore = ConnectionArgs.builder().last(LAST).before(before).build();
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.fromConnectionArgs(lastBefore);
        String startCursor = KeysetCursor.ofString("hostname", Sort.Direction.DESC, "host-b", ASSIGNED_ROW).encode();
        String endCursor = KeysetCursor.ofString("hostname", Sort.Direction.DESC, "host-a", OTHER_ROW).encode();
        CountedGenericQueryResult<Machine> page = page(startCursor, endCursor);
        when(dfe.getSource()).thenReturn(schedule);
        when(scheduleDeviceService.getMachineIds(SCHEDULE_ID)).thenReturn(ASSIGNED_MACHINE_IDS);
        when(deviceService.queryAssignedDevices(ASSIGNED_MACHINE_IDS, noFilter, backwardPage, SEARCH, BY_HOSTNAME))
                .thenReturn(page);

        // execution
        CountedGenericConnection<GenericEdge<Machine>> result =
                dataFetcher.assignedDevices(dfe, null, FIRST, null, LAST, before, SEARCH, BY_HOSTNAME);

        // verifications
        assertThat(result.getPageInfo())
                .returns(startCursor, PageInfo::getStartCursor)
                .returns(endCursor, PageInfo::getEndCursor);
        assertThat(backwardPage)
                .returns(true, CursorPaginationCriteria::isBackward)
                .returns(LAST, CursorPaginationCriteria::getLimit);
        assertThat(KeysetCursor.parseDecoded(backwardPage.getCursor())).isEqualTo(cursor);
    }

    @Test
    void availableDevices_lastAndBeforeWithASort_thePickerQueryGetsTheBackwardPageAndTheSortIsLeftOut() {
        // setup
        KeysetCursor cursor = new KeysetCursor("bucket", Sort.Direction.ASC, "2", CURSOR_ROW);
        String before = cursor.encode();
        ConnectionArgs lastBefore = ConnectionArgs.builder().last(LAST).before(before).build();
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.fromConnectionArgs(lastBefore);
        Set<String> assigned = Set.of(ASSIGNED_MACHINE_ID);
        String startCursor = new KeysetCursor("bucket", Sort.Direction.ASC, "0", ASSIGNED_ROW).encode();
        String endCursor = new KeysetCursor("bucket", Sort.Direction.ASC, "1", OTHER_ROW).encode();
        CountedGenericQueryResult<Machine> page = page(startCursor, endCursor);
        when(dfe.getSource()).thenReturn(schedule);
        when(scheduleDeviceService.getMachineIds(SCHEDULE_ID)).thenReturn(ASSIGNED_MACHINE_IDS);
        when(deviceService.queryAvailableDevicesForSchedule(PLATFORMS, assigned, noFilter, backwardPage, SEARCH))
                .thenReturn(page);

        // execution
        CountedGenericConnection<AvailableDeviceEdge> result =
                dataFetcher.availableDevices(dfe, null, FIRST, null, LAST, before, SEARCH, BY_HOSTNAME);

        // verifications
        assertThat(result.getPageInfo())
                .returns(startCursor, PageInfo::getStartCursor)
                .returns(endCursor, PageInfo::getEndCursor);
        assertThat(result.getEdges())
                .extracting(edge -> edge.getNode().getMachineId(), AvailableDeviceEdge::isAssigned)
                .containsExactly(tuple(ASSIGNED_MACHINE_ID, true),
                        tuple(OTHER_MACHINE_ID, false));
        assertThat(backwardPage.isBackward()).isTrue();
        assertThat(KeysetCursor.parseDecoded(backwardPage.getCursor())).isEqualTo(cursor);
        verify(deviceService).queryAvailableDevicesForSchedule(PLATFORMS, assigned, noFilter, backwardPage, SEARCH);
        verifyNoMoreInteractions(deviceService);
    }

    private static CountedGenericQueryResult<Machine> page(String startCursor, String endCursor) {
        Machine assigned = machine(ASSIGNED_MACHINE_ID, ASSIGNED_ROW);
        Machine other = machine(OTHER_MACHINE_ID, OTHER_ROW);
        PageInfo pageInfo = PageInfo.builder().hasNextPage(true).hasPreviousPage(false)
                .startCursor(startCursor).endCursor(endCursor).build();
        return CountedGenericQueryResult.<Machine>builder()
                .items(List.of(assigned, other))
                .pageInfo(pageInfo)
                .filteredCount(2)
                .build();
    }

    private static Machine machine(String machineId, String id) {
        Machine machine = new Machine();
        machine.setId(id);
        machine.setMachineId(machineId);
        return machine;
    }
}
